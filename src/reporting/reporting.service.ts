//reporting/reporting.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ReportDefinition } from './entities/report-definition.entity';
import { ReportRun } from './entities/report-run.entity';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { Purchase } from '../inventory/purchase/entities/purchase.entity';
import { Product } from '../inventory/product/entities/product.entity';
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
  ) {}

  // === Report Definitions ===
  async createDefinition(
    dto: CreateReportDefinitionDto,
  ): Promise<ReportDefinition> {
    const definition = this.reportDefRepo.create({
      ...dto,
      company: { id: dto.companyId }, // ← hook up company here
    });
    return this.reportDefRepo.save(definition);
  }

  async getAllDefinitions(): Promise<ReportDefinition[]> {
    return this.reportDefRepo.find();
  }

  async updateDefinition(
    id: string,
    dto: UpdateReportDefinitionDto,
  ): Promise<ReportDefinition> {
    const definition = await this.reportDefRepo.findOne({ where: { id } });

    if (!definition) {
      throw new NotFoundException('Report definition not found');
    }

    Object.assign(definition, dto);
    return this.reportDefRepo.save(definition);
  }

  // === Report Runs ===
  async runReport(definitionId: string, dto: RunReportDto): Promise<ReportRun> {
    // 1. Load + validate definition
    const definition = await this.reportDefRepo.findOne({
      where: { id: definitionId },
    });
    if (!definition)
      throw new NotFoundException(`Definition ${definitionId} not found`);

    // 2. Extract and validate dates
    const rawFromVal: unknown = dto.filters?.dateFrom;
    const rawToVal: unknown = dto.filters?.dateTo;
    let rawFrom: string;
    let rawTo: string;

    if (typeof rawFromVal === 'string' && typeof rawToVal === 'string') {
      rawFrom = rawFromVal;
      rawTo = rawToVal;
    } else {
      const params = definition.parameters as {
        dateFrom: string;
        dateTo: string;
      };
      if (!params.dateFrom || !params.dateTo) {
        throw new BadRequestException(
          'Definition parameters must include dateFrom and dateTo',
        );
      }
      rawFrom = params.dateFrom;
      rawTo = params.dateTo;
    }

    const from = new Date(rawFrom);
    const to = new Date(rawTo);
    to.setHours(23, 59, 59, 999);

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Invalid date range');
    }

    // 3. Create pending run
    let run = this.reportRunRepo.create({
      definition,
      status: 'pending',
      format: dto.format, // ✅ THIS IS REQUIRED
      filters: dto.filters, // optional but useful
      resultLocation: { format: dto.format, path: '' },
    });

    run = await this.reportRunRepo.save(run);

    try {
      // 4. Fetch raw data
      let outputRows: Array<Record<string, string | number>>;

      if (definition.type === 'sales') {
        // fetch sales with their items
        const sales = await this.saleRepo.find({
          where: { soldAt: Between(from, to) },
          relations: ['items', 'items.product', 'warehouse'],
        });

        // produce one row per SaleItem
        outputRows = sales.flatMap((sale) =>
          sale.items.map((item) => ({
            Date: sale.soldAt.toISOString().slice(0, 10),
            Product: item.product.name,
            Warehouse: sale.warehouse.name,
            Quantity: item.quantity,
            Unit_Price: item.unitPrice,
            Total: item.quantity * item.unitPrice,
          })),
        );
      } else if (
        definition.type === 'purchases' ||
        definition.type === 'financial'
      ) {
        const purchaseRows = (await this.purchaseRepo.find({
          where: { createdAt: Between(from, to) },
          relations: ['product', 'supplier'],
          select: ['createdAt', 'quantity', 'unitCost'] as (keyof Purchase)[],
        })) as Array<
          Purchase & { product: { name: string }; supplier: { name: string } }
        >;

        outputRows = purchaseRows.map((p) => ({
          Date: p.createdAt.toISOString().slice(0, 10),
          Product: p.product.name,
          Supplier: p.supplier.name,
          Quantity: p.quantity,
          Unit_Cost: p.unitCost,
          Total: p.quantity * p.unitCost,
        }));
      } else if (definition.type === 'inventory') {
        outputRows = await this.generateInventoryReport(
          from,
          to,
          dto.filters ?? {},
        );
      } else {
        throw new BadRequestException(
          `Unsupported report type "${String(definition.type)}"`,
        );
      }

      // 5. Ensure folder
      const folder = resolve(process.env.REPORTS_DIR || './reports');
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });

      // 6. Write file
      const filename = `${run.id}.${dto.format}`;
      const fullPath = join(folder, filename);
      if (dto.format === 'csv') {
        writeFileSync(fullPath, stringify(outputRows, { header: true }));
      } else if (dto.format === 'json') {
        writeFileSync(fullPath, JSON.stringify(outputRows, null, 2));
      } else {
        throw new BadRequestException(`Unsupported format: ${dto.format}`);
      }

      // 7. Complete run
      run.status = 'completed';
      run.resultLocation = { format: dto.format, path: fullPath };
      return await this.reportRunRepo.save(run);
    } catch (error) {
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
  async createDashboard(dto: CreateDashboardDto): Promise<Dashboard> {
    const dashboard = this.dashboardRepo.create(dto);
    return this.dashboardRepo.save(dashboard);
  }

  async getAllDashboards(): Promise<Dashboard[]> {
    return this.dashboardRepo.find({ relations: ['widgets'] });
  }

  async getDashboardById(id: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id },
      relations: ['widgets'],
    });
    if (!dashboard) throw new NotFoundException(`Dashboard ${id} not found`);
    return dashboard;
  }

  async updateDashboard(
    id: string,
    dto: UpdateDashboardDto,
  ): Promise<Dashboard> {
    await this.dashboardRepo.update(id, dto);
    return this.getDashboardById(id);
  }

  async deleteDashboard(id: string): Promise<void> {
    const result = await this.dashboardRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Dashboard ${id} not found`);
  }

  // === Widgets ===
  async createWidget(
    dashboardId: string,
    dto: CreateWidgetDto,
  ): Promise<DashboardWidget> {
    const dashboard = await this.getDashboardById(dashboardId);
    const widget = this.widgetRepo.create({ ...dto, dashboard });
    return this.widgetRepo.save(widget);
  }

  async updateWidget(
    id: string,
    dto: UpdateWidgetDto,
  ): Promise<DashboardWidget> {
    await this.widgetRepo.update(id, dto);
    const widget = await this.widgetRepo.findOne({
      where: { id },
      relations: ['dashboard'],
    });
    if (!widget) throw new NotFoundException(`Widget ${id} not found`);
    return widget;
  }

  async deleteWidget(id: string): Promise<void> {
    const result = await this.widgetRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Widget ${id} not found`);
  }

  /**
   * Generate per-product inventory totals:
   *  - purchasedQty: sum of Purchase.quantity
   *  - soldQty:     sum of Sale.quantity
   *  - currentQty:  Product.quantity
   */
  private async generateInventoryReport(
    from: Date,
    to: Date,
    filters?: Record<string, any>,
  ): Promise<Array<Record<string, string | number>>> {
    // Sum purchases
    const purchaseSums = await this.purchaseRepo
      .createQueryBuilder('p')
      .select('p.productId', 'productId')
      .addSelect('SUM(p.quantity)', 'purchasedQty')
      .where('p.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('p.productId')
      .getRawMany<{ productId: string; purchasedQty: string }>();

    // Sum sales
    const saleSums = await this.saleRepo
      .createQueryBuilder('s')
      .select('s.productId', 'productId')
      .addSelect('SUM(s.quantity)', 'soldQty')
      .where('s.soldAt BETWEEN :from AND :to', { from, to })
      .groupBy('s.productId')
      .getRawMany<{ productId: string; soldQty: string }>();

    // Map to lookup
    const purchasedMap = Object.fromEntries(
      purchaseSums.map((r) => [r.productId, Number(r.purchasedQty)]),
    );
    const soldMap = Object.fromEntries(
      saleSums.map((r) => [r.productId, Number(r.soldQty)]),
    );

    // Load products (apply filters)
    const qb = this.productRepo.createQueryBuilder('prod');
    // Destructure filters with safe defaults (assert typed)
    const { categoryId, supplierId } = (filters ?? {}) as ReportFilters;

    // Apply category filter if provided
    if (categoryId) {
      qb.andWhere('prod.categoryId = :categoryId', { categoryId });
    }

    // Apply supplier filter if provided
    if (supplierId) {
      qb.andWhere('prod.supplierId = :supplierId', { supplierId });
    }

    const products = await qb.getMany();
    // Build rows
    return products.map((p) => ({
      productId: p.id,
      productName: p.name,
      purchasedQty: purchasedMap[p.id] ?? 0,
      soldQty: soldMap[p.id] ?? 0,
      currentQty: p.quantity,
    }));
  }
}
