// src/reporting/reporting.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DeepPartial } from 'typeorm';
import { ReportDefinition } from './entities/report-definition.entity';
import { ReportRun } from './entities/report-run.entity';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { Purchase } from '../inventory/purchase/entities/purchase.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { ReportFilters } from './dto/run-report.dto';
import { RunReportDto } from './dto/run-report.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { stringify } from 'csv-stringify/sync';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

type PurchaseWithRelations = Purchase & {
  product?: { name?: string };
  supplier?: { name?: string };
};

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportDefinition)
    private readonly reportDefRepo: Repository<ReportDefinition>,
    @InjectRepository(ReportRun)
    private readonly reportRunRepo: Repository<ReportRun>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(DashboardWidget)
    private readonly widgetRepo: Repository<DashboardWidget>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
  ) {}

  // === Report Definitions ===

  async createDefinition(
    dto: CreateReportDefinitionDto,
    companyId?: string | null,
  ): Promise<ReportDefinition> {
    const payload: DeepPartial<ReportDefinition> = { ...dto };

    if (companyId) {
      const companyRel: DeepPartial<ReportDefinition['company']> = {
        id: companyId,
      };
      payload.company = companyRel;
    }

    const definition = this.reportDefRepo.create(payload);
    return this.reportDefRepo.save(definition);
  }

  async getAllDefinitions(
    companyId?: string | null,
  ): Promise<ReportDefinition[]> {
    const qb = this.reportDefRepo
      .createQueryBuilder('rd')
      .leftJoinAndSelect('rd.company', 'company');

    // If companyId provided, return both global (company IS NULL) and company-specific definitions
    if (companyId) {
      qb.where('(company.id = :companyId) OR (company.id IS NULL)', {
        companyId,
      });
    }

    return qb.getMany();
  }

  async updateDefinition(
    id: string,
    dto: UpdateReportDefinitionDto,
    companyId?: string | null,
  ): Promise<ReportDefinition> {
    const definition = await this.reportDefRepo.findOne({
      where: { id },
      relations: ['company'],
    });

    if (!definition) {
      throw new NotFoundException('Report definition not found');
    }

    // If a company is supplied, ensure the definition belongs to that company or is global
    if (
      companyId &&
      definition.company &&
      definition.company.id !== companyId
    ) {
      throw new NotFoundException(
        'Report definition not found for this company',
      );
    }

    // Do not blindly overwrite 'company' via DTO (keep company management separate)
    const updatable = { ...dto } as Partial<ReportDefinition>;
    Object.assign(definition, updatable);
    return this.reportDefRepo.save(definition);
  }

  // === Report Runs ===
  // _userId kept for future use
  async runReport(
    definitionId: string,
    dto: RunReportDto,
    companyId?: string | null,
    _userId?: string | null,
  ): Promise<ReportRun> {
    void _userId;

    // 1. Load + validate definition
    const definition = await this.reportDefRepo.findOne({
      where: { id: definitionId },
      relations: ['company'],
    });
    if (!definition) {
      throw new NotFoundException(`Definition ${definitionId} not found`);
    }

    // If a specific company was passed, ensure user is allowed to run for that company
    if (
      companyId &&
      definition.company &&
      definition.company.id !== companyId
    ) {
      throw new NotFoundException(
        `Definition ${definitionId} not available for this company`,
      );
    }

    // Determine effective companyId for the run:
    // prefer explicit companyId param; otherwise, if definition is company-scoped, use its company
    const effectiveCompanyId =
      companyId ?? (definition.company ? definition.company.id : null);

    if (!effectiveCompanyId) {
      throw new BadRequestException(
        'A companyId is required to run this report (definition is global; you must pass companyId).',
      );
    }

    // 2. Extract & validate date range
    const rawFromVal: unknown = dto.filters?.dateFrom;
    const rawToVal: unknown = dto.filters?.dateTo;
    let rawFrom: string;
    let rawTo: string;

    if (typeof rawFromVal === 'string' && typeof rawToVal === 'string') {
      rawFrom = rawFromVal;
      rawTo = rawToVal;
    } else {
      const params =
        (definition.parameters as { dateFrom?: string; dateTo?: string }) ??
        undefined;
      if (!params?.dateFrom || !params?.dateTo) {
        throw new BadRequestException(
          'Definition parameters must include dateFrom and dateTo',
        );
      }
      rawFrom = params.dateFrom!;
      rawTo = params.dateTo!;
    }

    const from = new Date(rawFrom);
    const to = new Date(rawTo);
    to.setHours(23, 59, 59, 999);

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Invalid date range');
    }

    // 3. Create pending run
    const defRel: DeepPartial<ReportRun['definition']> = { id: definition.id };
    const runPayload: DeepPartial<ReportRun> = {
      definition: defRel,
      status: 'pending',
      format: dto.format,
      filters: dto.filters ?? {},
      // include company relation for run - report runs are company-scoped
      company: { id: effectiveCompanyId } as DeepPartial<ReportRun['company']>,
      resultLocation: { format: String(dto.format), path: '' },
    };

    const pending = this.reportRunRepo.create(
      runPayload as DeepPartial<ReportRun>,
    );
    let run = await this.reportRunRepo.save(pending);

    try {
      // 4. Fetch and construct rows - always scope to effectiveCompanyId
      let outputRows: Array<Record<string, string | number>> = [];

      if (definition.type === 'sales') {
        const sales = await this.saleRepo.find({
          where: {
            soldAt: Between(from, to),
            companyId: effectiveCompanyId,
          },
          relations: ['items', 'items.product', 'warehouse'],
        });

        outputRows = sales.flatMap((sale) =>
          sale.items.map((item) => ({
            Date: sale.soldAt.toISOString().slice(0, 10),
            Product: item.product?.name ?? '',
            Warehouse: sale.warehouse?.name ?? '',
            Quantity: Number(item.quantity ?? 0),
            Unit_Price: Number(item.unitPrice ?? 0),
            Total: Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0),
          })),
        );
      } else if (
        definition.type === 'purchases' ||
        definition.type === 'financial'
      ) {
        // purchases - ensure company scope
        const purchaseRows = (await this.purchaseRepo
          .createQueryBuilder('p')
          .leftJoinAndSelect('p.product', 'product')
          .leftJoinAndSelect('p.supplier', 'supplier')
          .where('p.companyId = :companyId', { companyId: effectiveCompanyId })
          .andWhere('p.createdAt BETWEEN :from AND :to', { from, to })
          .getMany()) as PurchaseWithRelations[];

        outputRows = purchaseRows.map((p) => {
          const date =
            p.createdAt instanceof Date
              ? p.createdAt.toISOString().slice(0, 10)
              : String(p.createdAt);
          const productName = p.product?.name ?? '';
          const supplierName = p.supplier?.name ?? '';
          const qty = Number(
            (p as unknown as { quantity?: number }).quantity ?? 0,
          );
          const unitCost = Number(
            (p as unknown as { unitCost?: number }).unitCost ?? 0,
          );
          return {
            Date: date,
            Product: productName,
            Supplier: supplierName,
            Quantity: qty,
            Unit_Cost: unitCost,
            Total: qty * unitCost,
          };
        });
      } else if (definition.type === 'inventory') {
        outputRows = await this.generateInventoryReport(
          from,
          to,
          dto.filters ?? {},
          effectiveCompanyId,
        );
      } else {
        throw new BadRequestException(
          `Unsupported report type "${String(definition.type)}"`,
        );
      }

      // 5. Ensure folder exists
      const folder = resolve(process.env.REPORTS_DIR || './reports');
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });

      // 6. Write file
      const filename = `${String(run.id)}.${String(dto.format)}`;
      const fullPath = join(folder, filename);
      const fmt: string = String(dto.format);

      if (fmt === 'csv') {
        writeFileSync(fullPath, stringify(outputRows, { header: true }));
      } else if (fmt === 'json') {
        writeFileSync(fullPath, JSON.stringify(outputRows, null, 2));
      } else if (fmt === 'xlsx') {
        // not implemented
        throw new BadRequestException('XLSX export not implemented');
      } else {
        throw new BadRequestException(`Unsupported format: ${String(fmt)}`);
      }

      // 7. Complete run
      run.status = 'completed';
      run.resultLocation = { format: fmt, path: fullPath };
      run = await this.reportRunRepo.save(run);
      return run;
    } catch (error) {
      // mark failed run and rethrow
      run.status = 'failed';
      await this.reportRunRepo.save(run);
      throw error;
    }
  }

  async getRunById(runId: string): Promise<ReportRun> {
    const run = await this.reportRunRepo.findOne({
      where: { id: runId },
      relations: ['definition'],
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  // === Dashboards ===

  async createDashboard(
    dto: CreateDashboardDto,
    companyId?: string | null,
  ): Promise<Dashboard> {
    const payload: DeepPartial<Dashboard> = { ...dto };
    if (companyId) {
      const companyRel: DeepPartial<Dashboard['company']> = { id: companyId };
      payload.company = companyRel;
    }

    const dashboard = this.dashboardRepo.create(payload);
    return this.dashboardRepo.save(dashboard);
  }

  async getAllDashboards(companyId?: string | null): Promise<Dashboard[]> {
    const qb = this.dashboardRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.widgets', 'widgets')
      .leftJoinAndSelect('d.company', 'company');

    if (companyId) {
      qb.where('(company.id = :companyId) OR (company.id IS NULL)', {
        companyId,
      });
    }

    return qb.getMany();
  }

  async getDashboardById(
    id: string,
    companyId?: string | null,
  ): Promise<Dashboard> {
    const qb = this.dashboardRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.widgets', 'widgets')
      .leftJoinAndSelect('d.company', 'company')
      .where('d.id = :id', { id });

    if (companyId) {
      qb.andWhere('(company.id = :companyId) OR (company.id IS NULL)', {
        companyId,
      });
    }

    const dashboard = await qb.getOne();
    if (!dashboard) throw new NotFoundException(`Dashboard ${id} not found`);
    return dashboard;
  }

  async updateDashboard(
    id: string,
    dto: UpdateDashboardDto,
    companyId?: string | null,
  ): Promise<Dashboard> {
    await this.getDashboardById(id, companyId);
    await this.dashboardRepo.update(id, dto);
    return this.getDashboardById(id, companyId);
  }

  async deleteDashboard(id: string, companyId?: string | null): Promise<void> {
    await this.getDashboardById(id, companyId);
    const result = await this.dashboardRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Dashboard ${id} not found`);
  }

  // === Widgets ===

  async createWidget(
    dashboardId: string,
    dto: CreateWidgetDto,
    companyId?: string | null,
  ): Promise<DashboardWidget> {
    // ensure dashboard belongs to company (or is global)
    const dashboard = await this.getDashboardById(dashboardId, companyId);

    // widget must belong to same company as dashboard (dashboard.company may be null for global)
    const dashboardCompanyId = dashboard.company ? dashboard.company.id : null;
    if (companyId && dashboardCompanyId && dashboardCompanyId !== companyId) {
      throw new NotFoundException(
        `Dashboard ${dashboardId} not found for this company`,
      );
    }

    const dashboardRel: DeepPartial<DashboardWidget['dashboard']> = {
      id: dashboard.id,
    };

    const widgetPayload: DeepPartial<DashboardWidget> = {
      ...dto,
      dashboard: dashboardRel,
      // ensure widget.company matches the dashboard (or passed company)
      company: dashboardCompanyId
        ? ({ id: dashboardCompanyId } as DeepPartial<
            DashboardWidget['company']
          >)
        : companyId
          ? ({ id: companyId } as DeepPartial<DashboardWidget['company']>)
          : undefined,
    };

    const widget = this.widgetRepo.create(
      widgetPayload as DeepPartial<DashboardWidget>,
    );
    return this.widgetRepo.save(widget);
  }

  async updateWidget(
    id: string,
    dto: UpdateWidgetDto,
    companyId?: string | null,
  ): Promise<DashboardWidget> {
    const widget = await this.widgetRepo.findOne({
      where: { id },
      relations: ['dashboard', 'dashboard.company'],
    });

    if (!widget) throw new NotFoundException(`Widget ${id} not found`);

    if (
      companyId &&
      widget.dashboard?.company &&
      widget.dashboard.company.id !== companyId
    ) {
      throw new NotFoundException(`Widget ${id} not found for this company`);
    }

    await this.widgetRepo.update(id, dto);

    const updated = await this.widgetRepo.findOne({
      where: { id },
      relations: ['dashboard'],
    });

    if (!updated) throw new NotFoundException(`Widget ${id} not found`);
    return updated;
  }

  async deleteWidget(id: string, companyId?: string | null): Promise<void> {
    const widget = await this.widgetRepo.findOne({
      where: { id },
      relations: ['dashboard', 'dashboard.company'],
    });

    if (!widget) throw new NotFoundException(`Widget ${id} not found`);

    if (
      companyId &&
      widget.dashboard?.company &&
      widget.dashboard.company.id !== companyId
    ) {
      throw new NotFoundException(`Widget ${id} not found for this company`);
    }

    const result = await this.widgetRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Widget ${id} not found`);
  }

  // Inventory helper
  private async generateInventoryReport(
    from: Date,
    to: Date,
    filters: Record<string, any> = {},
    companyId?: string,
  ): Promise<Array<Record<string, string | number>>> {
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required for inventory report',
      );
    }

    // purchases for the company
    const purchaseSums = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('p.productId', 'productId')
      .addSelect('SUM(p.quantity)', 'purchasedQty')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('p.productId')
      .getRawMany<{ productId: string; purchasedQty: string }>();

    // sales for the company
    const saleSums = await this.saleRepo
      .createQueryBuilder('s')
      .select('si.productId', 'productId')
      .addSelect('SUM(si.quantity)', 'soldQty')
      .leftJoin('s.items', 'si')
      .where('s.companyId = :companyId', { companyId })
      .andWhere('s.soldAt BETWEEN :from AND :to', { from, to })
      .groupBy('si.productId')
      .getRawMany<{ productId: string; soldQty: string }>();

    const purchasedMap = Object.fromEntries(
      purchaseSums.map((r) => [Number(r.productId), Number(r.purchasedQty)]),
    );
    const soldMap = Object.fromEntries(
      saleSums.map((r) => [Number(r.productId), Number(r.soldQty)]),
    );

    // Restrict products to company
    const qb = this.productRepo
      .createQueryBuilder('prod')
      .where('prod."companyId" = :companyId', { companyId });
    const { categoryId, supplierId } = (filters ?? {}) as ReportFilters;
    if (categoryId)
      qb.andWhere('prod.categoryId = :categoryId', { categoryId });
    if (supplierId)
      qb.andWhere('prod.supplierId = :supplierId', { supplierId });

    const products = await qb.getMany();
    const productIds = products.map((p) => p.id);

    // stock by product per company
    const stockSums = await this.stockLevelRepo
      .createQueryBuilder('sl')
      .select('sl.productId', 'productId')
      .addSelect('SUM(sl.quantity)', 'currentQty')
      .where('sl.companyId = :companyId', { companyId })
      .andWhere('sl.productId IN (:...ids)', {
        ids: productIds.length ? productIds : [0],
      })
      .groupBy('sl.productId')
      .getRawMany<{ productId: string; currentQty: string }>();

    const currentMap = Object.fromEntries(
      stockSums.map((r) => [Number(r.productId), Number(r.currentQty)]),
    );

    return products.map((p) => ({
      productId: p.id,
      productName: p.name,
      purchasedQty: purchasedMap[p.id] ?? 0,
      soldQty: soldMap[p.id] ?? 0,
      currentQty: currentMap[p.id] ?? 0,
    }));
  }
}
