// src/inventory/product/product.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DeepPartial } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { Product } from './entities/product.entity';
import { Category } from '../category/entities/category.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateAuditLogDto } from '../audit-log/dto/create-audit-log.dto';
import {
  ImportProductRowDto,
  ImportSummaryDto,
  ImportRowResult,
} from './dto/import-product-row.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,

    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    private readonly audit: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  // --- safe extractors (typed) ---
  private getErrorCode(err: unknown): string | undefined {
    if (err && typeof err === 'object') {
      const maybe = err as Record<string, unknown>;
      const code = maybe['code'];
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }

  private getConstraintName(err: unknown): string | undefined {
    if (err && typeof err === 'object') {
      const maybe = err as Record<string, unknown>;
      const constraint = maybe['constraint'];
      return typeof constraint === 'string' ? constraint : undefined;
    }
    return undefined;
  }

  private buildCompanyWhere(companyId: string): FindOptionsWhere<Product> {
    return { companyId };
  }

  private parseNumericId(value: string, label = 'ID'): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`Invalid ${label}: ${value}`);
    }
    return parsed;
  }

  private mapDtoToEntity(
    dto: CreateProductDto | UpdateProductDto,
  ): DeepPartial<Product> {
    const partial: DeepPartial<Product> = {};
    if ('name' in dto && dto.name !== undefined) partial.name = dto.name;
    if ('sku' in dto && dto.sku !== undefined) partial.sku = dto.sku;
    if ('barcode' in dto) partial.barcode = dto.barcode;
    if ('description' in dto) partial.description = dto.description;
    if ('unitPrice' in dto && dto.unitPrice !== undefined)
      partial.unitPrice = dto.unitPrice;
    if ('productNumber' in dto && dto.productNumber !== undefined)
      partial.productNumber = dto.productNumber;
    if ('unit' in dto && dto.unit !== undefined) partial.unit = dto.unit;
    if ('categoryId' in dto && dto.categoryId !== undefined) {
      partial.categoryId = String(dto.categoryId);
    }
    if ('supplierId' in dto && dto.supplierId !== undefined) {
      partial.supplierId = String(dto.supplierId);
    }
    return partial;
  }

  private generateBarcode(): string {
    return Math.floor(Math.random() * 1_000_000_000_000)
      .toString()
      .padStart(12, '0');
  }

  async findDropdown(companyId: string) {
    return this.repo.find({
      where: { companyId },
      select: ['id', 'name', 'sku'],
      order: { name: 'ASC' },
    });
  }

  private async generateUniqueBarcode(): Promise<string> {
    let tries = 0;
    while (tries < 10) {
      const barcode = this.generateBarcode();
      const existing = await this.repo.findOne({ where: { barcode } });
      if (!existing) return barcode;
      tries += 1;
    }
    return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  }

  /** Create a new product for a specific company */
  async create(
    companyId: string,
    dto: CreateProductDto,
    userId?: string,
  ): Promise<Product> {
    // validate FKs if present
    if (dto.categoryId) {
      const exists = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, companyId },
      });
      if (!exists) {
        throw new BadRequestException(`categoryId ${dto.categoryId} not found`);
      }
    }
    if (dto.supplierId) {
      const exists = await this.supplierRepo.findOne({
        where: { id: dto.supplierId, companyId },
      });
      if (!exists) {
        throw new BadRequestException(`supplierId ${dto.supplierId} not found`);
      }
    }

    if (!dto.barcode) {
      dto.barcode = await this.generateUniqueBarcode();
    }

    const base: Pick<Product, 'companyId'> = { companyId };
    const entity = this.repo.create({ ...base, ...this.mapDtoToEntity(dto) });

    try {
      const saved = await this.repo.save(entity);
      this.logger.log(
        `Product created: ${saved.id} (Company: ${companyId}) [companyId=${companyId}]`,
      );

      if (userId) {
        await this.audit.log({
          action: 'CREATE',
          entity: 'product',
          entityId: String(saved.id),
          userId,
          companyId,
          changes: saved,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }
      return saved;
    } catch (err: unknown) {
      const code = this.getErrorCode(err);
      const constraint = this.getConstraintName(err);
      if (code === '23505') {
        if (constraint === 'products_sku_unique') {
          throw new BadRequestException(
            'A product with this SKU already exists.',
          );
        }
        if (constraint === 'products_barcode_unique') {
          throw new BadRequestException(
            'A product with this barcode already exists.',
          );
        }
        throw new BadRequestException('SKU or barcode already exists.');
      }
      this.logger.error(
        `Failed to create product for company ${companyId}: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
      throw new InternalServerErrorException('Unable to create product');
    }
  }

  /**
   * List all products for a given company, with optional pagination and filters.
   * Returns: { data: Product[], total: number, page: number, limit: number }
   */
  async findAll(
    companyId: string,
    opts?: {
      search?: string;
      page?: number;
      limit?: number;
      categoryId?: string;
      supplierId?: string;
      sort?: string; // e.g., name:asc | createdAt:desc
    },
  ): Promise<{ data: Product[]; total: number; page: number; limit: number }> {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 25;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.supplier', 'supplier')
      .where('p.companyId = :companyId', { companyId });

    if (opts?.search) {
      // Postgres: case-insensitive ILIKE search
      qb.andWhere('(p.name ILIKE :q OR p.sku ILIKE :q OR p.barcode ILIKE :q)', {
        q: `%${opts.search}%`,
      });
    }
    if (opts?.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', {
        categoryId: opts.categoryId,
      });
    }
    if (opts?.supplierId) {
      qb.andWhere('p.supplierId = :supplierId', {
        supplierId: opts.supplierId,
      });
    }

    // Sorting (whitelist)
    const sortable: Record<string, true> = {
      name: true,
      createdAt: true,
      sku: true,
      unitPrice: true,
    };
    let orderBy = 'p.createdAt';
    let direction: 'ASC' | 'DESC' = 'DESC';

    if (opts?.sort) {
      const [field, dirRaw] = opts.sort.split(':');
      if (field && sortable[field]) {
        orderBy = `p.${field}`;
        direction = dirRaw?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      }
    }

    qb.orderBy(orderBy, direction).skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  /** Fetch one product by company + ID */
  async findOne(companyId: string, id: string): Promise<Product> {
    const productId = this.parseNumericId(id, 'productId');
    const product = await this.repo.findOne({
      where: { ...this.buildCompanyWhere(companyId), id: productId },
      relations: ['category', 'supplier'],
    });
    if (!product) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );
    }
    return product;
  }

  /** Update a product by company + ID */
  async update(
    companyId: string,
    id: string,
    dto: UpdateProductDto,
    userId?: string,
  ): Promise<Product> {
    const productId = this.parseNumericId(id, 'productId');
    await this.findOne(companyId, id);

    // validate provided category/supplier (if present)
    if (dto.categoryId) {
      const exists = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, companyId },
      });
      if (!exists) {
        throw new BadRequestException(`categoryId ${dto.categoryId} not found`);
      }
    }
    if (dto.supplierId) {
      const exists = await this.supplierRepo.findOne({
        where: { id: dto.supplierId, companyId },
      });
      if (!exists) {
        throw new BadRequestException(`supplierId ${dto.supplierId} not found`);
      }
    }

    try {
      await this.repo.update(
        { ...this.buildCompanyWhere(companyId), id: productId },
        this.mapDtoToEntity(dto),
      );
      const updated = await this.findOne(companyId, id);
      this.logger.log(
        `Product updated: ${updated.id} [companyId=${companyId}]`,
      );

      if (userId) {
        await this.audit.log({
          action: 'UPDATE',
          entity: 'product',
          entityId: String(updated.id),
          userId,
          companyId,
          changes: dto,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }

      return updated;
    } catch (err: unknown) {
      const code = this.getErrorCode(err);
      const constraint = this.getConstraintName(err);
      if (code === '23505') {
        if (constraint === 'products_sku_unique') {
          throw new BadRequestException(
            'A product with this SKU already exists.',
          );
        }
        if (constraint === 'products_barcode_unique') {
          throw new BadRequestException(
            'A product with this barcode already exists.',
          );
        }
        throw new BadRequestException('SKU or barcode already exists.');
      }
      this.logger.error(
        `Failed to update product: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
      throw new InternalServerErrorException('Unable to update product');
    }
  }

  /** Delete a product by company + ID */
  async remove(companyId: string, id: string, userId?: string): Promise<void> {
    const productId = this.parseNumericId(id, 'productId');
    try {
      const result = await this.repo.delete({
        ...this.buildCompanyWhere(companyId),
        id: productId,
      });
      if (!result.affected) {
        throw new NotFoundException(
          `Product ${productId} not found for company ${companyId}`,
        );
      }
      this.logger.log(`Product deleted: ${productId} [companyId=${companyId}]`);

      if (userId) {
        await this.audit.log({
          action: 'DELETE',
          entity: 'product',
          entityId: String(productId),
          userId,
          companyId,
          changes: undefined,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }
    } catch (err: unknown) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(
        `Failed to delete product: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
      throw new InternalServerErrorException('Unable to delete product');
    }
  }

  /**
   * Import products from CSV buffer.
   * - Validates each row.
   * - If dryRun=true, returns summary only (no writes).
   * - If dryRun=false, writes in a single transaction; continues row-by-row so one bad row doesn't abort all.
   */
  async importCsv(
    companyId: string,
    csvBuffer: Buffer,
    dryRun = true,
    userId?: string,
  ): Promise<ImportSummaryDto> {
    const text = csvBuffer.toString('utf8');

    // Parse CSV
    const records: Record<string, string>[] = parse(text, {
      columns: true, // use header row
      skip_empty_lines: true,
      trim: true,
    });

    const results: ImportRowResult[] = [];
    const validRows: ImportProductRowDto[] = [];
    const seenSku = new Set<string>();

    // First pass: validate structure & field rules (class-validator)
    for (let i = 0; i < records.length; i++) {
      const raw = records[i];
      const row = plainToInstance(ImportProductRowDto, raw, {
        enableImplicitConversion: true,
      });
      const errors = await validate(row, {
        whitelist: true,
        forbidUnknownValues: false,
      });
      const errMsgs: string[] = [];

      if (errors.length) {
        errMsgs.push(
          ...errors.flatMap((e) =>
            Object.values(e.constraints ?? {}).map(String),
          ),
        );
      }

      // Ensure SKU uniqueness within the file itself
      if (row.sku) {
        if (seenSku.has(row.sku)) {
          errMsgs.push(`Duplicate SKU in file: ${row.sku}`);
        } else {
          seenSku.add(row.sku);
        }
      }

      if (errMsgs.length) {
        results.push({ ok: false, sku: raw.sku, errors: errMsgs });
      } else {
        validRows.push(row);
        results.push({ ok: true, sku: row.sku });
      }
    }

    // Early return for dry run: also check DB existence for SKUs and IDs if possible
    // (We’ll enrich errors with DB collisions)
    const enrichDbChecks = async () => {
      for (let idx = 0; idx < results.length; idx++) {
        const r = results[idx];
        if (!r.ok) continue;
        const row = validRows.find((v) => v.sku === r.sku);
        if (!row) continue;

        // SKU uniqueness (global or per-DB constraint). Entity has unique(sku), so check by sku.
        const existing = await this.repo.findOne({ where: { sku: row.sku } });
        if (existing) {
          results[idx] = {
            ok: false,
            sku: row.sku,
            errors: [`SKU already exists: ${row.sku}`],
          };
          continue;
        }

        // FK checks within company (if provided)
        if (row.categoryId) {
          const cat = await this.categoryRepo.findOne({
            where: { id: row.categoryId, companyId },
          });
          if (!cat) {
            results[idx] = {
              ok: false,
              sku: row.sku,
              errors: [`categoryId not found in company: ${row.categoryId}`],
            };
            continue;
          }
        }
        if (row.supplierId) {
          const sup = await this.supplierRepo.findOne({
            where: { id: row.supplierId, companyId },
          });
          if (!sup) {
            results[idx] = {
              ok: false,
              sku: row.sku,
              errors: [`supplierId not found in company: ${row.supplierId}`],
            };
            continue;
          }
        }
      }
    };

    await enrichDbChecks();

    const summary: ImportSummaryDto = {
      total: records.length,
      valid: results.filter((r) => r.ok).length,
      invalid: results.filter((r) => !r.ok).length,
      createdIds: [],
      results,
    };

    if (dryRun) {
      return summary;
    }

    // Real run: insert valid rows inside a transaction (skip invalid rows)
    await this.dataSource.transaction(async (manager) => {
      for (const r of results) {
        if (!r.ok || !r.sku) continue;
        const row = validRows.find((v) => v.sku === r.sku);
        if (!row) continue;

        try {
          const entity = this.repo.create({
            companyId,
            name: row.name,
            sku: row.sku,
            barcode: row.barcode ?? (await this.generateUniqueBarcode()),
            description: row.description,
            unitPrice: row.unitPrice,
            productNumber: row.productNumber,
            unit: row.unit,
            categoryId: row.categoryId,
            supplierId: row.supplierId,
          });

          const saved = await manager.getRepository(Product).save(entity);
          summary.createdIds.push(saved.id);

          if (userId) {
            await this.audit.log({
              action: 'CREATE',
              entity: 'product',
              entityId: String(saved.id),
              userId,
              companyId,
              changes: saved,
              timestamp: new Date(),
            } as CreateAuditLogDto);
          }
        } catch (err: unknown) {
          const code = this.getErrorCode(err);
          const constraint = this.getConstraintName(err);
          let msg = `Row failed (${r.sku})`;
          if (code === '23505') {
            if (constraint === 'products_sku_unique')
              msg = `Duplicate SKU: ${r.sku}`;
            else if (constraint === 'products_barcode_unique')
              msg = `Duplicate barcode for SKU ${r.sku}`;
            else msg = `Unique constraint violation for SKU ${r.sku}`;
          } else if (err instanceof Error) {
            msg = err.message;
          }
          // flip this row to error in results list
          const idx = summary.results.findIndex((x) => x.ok && x.sku === r.sku);
          if (idx >= 0)
            summary.results[idx] = { ok: false, sku: r.sku, errors: [msg] };
        }
      }
    });

    // Recompute counts after inserts/errors
    summary.valid = summary.results.filter((r) => r.ok).length;
    summary.invalid = summary.results.filter((r) => !r.ok).length;

    this.logger.log(
      `Import finished: total=${summary.total} created=${summary.createdIds.length} invalid=${summary.invalid} [companyId=${companyId}]`,
    );
    return summary;
  }
}
