// src/inventory/warehouse/warehouse.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Company } from '../company/entities/company.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly dataSource: DataSource,
  ) {}

  // Type guard for DB error shape
  private isDbError(e: unknown): e is { code?: unknown } {
    // avoid unnecessary type assertions — check shape using Object.prototype.hasOwnProperty
    return (
      typeof e === 'object' &&
      e !== null &&
      Object.prototype.hasOwnProperty.call(e, 'code')
    );
  }

  // This never returns (always throws) so TS knows catch paths do not fall-through.
  private handleUniqueError(error: unknown): never {
    if (this.isDbError(error)) {
      const maybe = error as Record<string, unknown>;
      const code = maybe.code;
      if (typeof code === 'string' && code === '23505') {
        throw new BadRequestException(
          'Warehouse with this name already exists.',
        );
      }
    }
    if (error instanceof Error) throw error;
    throw new Error('Unexpected database error');
  }

  async create(dto: CreateWarehouseDto, companyId: string): Promise<Warehouse> {
    const companyExists = await this.companyRepo.exist({
      where: { id: companyId },
    });
    if (!companyExists) {
      throw new NotFoundException(`Company with id ${companyId} not found`);
    }

    const warehouse = this.warehouseRepo.create({
      ...dto,
      companyId,
    });

    try {
      return await this.warehouseRepo.save(warehouse);
    } catch (err) {
      // handleUniqueError always throws (never returns)
      this.handleUniqueError(err);
    }
  }

  async findAll(
    companyId: string,
    query?: {
      search?: string;
      page?: number;
      limit?: number;
      includeDeleted?: boolean;
    },
  ): Promise<{
    data: Warehouse[];
    meta: { total: number; page: number; limit: number };
  }> {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, query?.limit || 10);
    const skip = (page - 1) * limit;

    const qb = this.warehouseRepo
      .createQueryBuilder('w')
      .where('w.companyId = :companyId', { companyId });

    if (query?.search) {
      qb.andWhere('w.name ILIKE :search OR w.address ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query?.includeDeleted) {
      qb.withDeleted();
    }

    qb.orderBy('w.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { total, page, limit },
    };
  }

  async findOne(id: string, companyId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({
      where: { id, companyId },
      relations: ['company'],
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with id ${id} not found for company ${companyId}`,
      );
    }
    return warehouse;
  }

  async update(
    id: string,
    dto: UpdateWarehouseDto,
    companyId: string,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(id, companyId);
    Object.assign(warehouse, dto);
    try {
      return await this.warehouseRepo.save(warehouse);
    } catch (err) {
      this.handleUniqueError(err);
    }
  }

  // helper: attempt to count rows from table; if table missing -> return 0
  private async countIfTableExists(
    table: string,
    warehouseId: string,
  ): Promise<number> {
    try {
      const raw: unknown = await this.dataSource.query(
        `SELECT COUNT(*)::text as count FROM ${table} WHERE "warehouseId" = $1`,
        [warehouseId],
      );

      if (!Array.isArray(raw) || raw.length === 0) return 0;

      const first = raw[0] as Record<string, unknown> | undefined;
      if (!first) return 0;

      const countVal = first.count;
      if (typeof countVal === 'string') {
        const n = Number(countVal);
        return Number.isFinite(n) ? n : 0;
      }
      if (typeof countVal === 'number') {
        return countVal;
      }

      return 0;
    } catch {
      // table probably doesn't exist — treat as zero dependents
      return 0;
    }
  }

  // helper: get sample of dependent rows (id + created_at) for quick preview; returns [] if table absent
  private async sampleDependents(
    table: string,
    warehouseId: string,
    limit = 5,
  ): Promise<Array<{ id: string; created_at: string }>> {
    try {
      const raw: unknown = await this.dataSource.query(
        `SELECT id, created_at FROM ${table} WHERE "warehouseId" = $1 ORDER BY created_at DESC LIMIT $2`,
        [warehouseId, limit],
      );

      if (!Array.isArray(raw)) return [];

      return raw.map((r: unknown) => {
        const rec = (r ?? {}) as Record<string, unknown>;

        // --- id sanitization (avoid base-to-string on objects) ---
        let idStr = '';
        if (rec.id === undefined || rec.id === null) {
          idStr = '';
        } else if (typeof rec.id === 'string' || typeof rec.id === 'number') {
          idStr = String(rec.id);
        } else if (rec.id instanceof Date) {
          idStr = rec.id.toISOString();
        } else if (typeof rec.id === 'object') {
          try {
            idStr = JSON.stringify(rec.id);
          } catch {
            idStr = '';
          }
        } else {
          // symbol or other unusual primitive — keep empty
          idStr = '';
        }

        // --- created_at sanitization (prefer ISO for Date objects) ---
        let createdAtStr = '';
        if (rec.created_at === undefined || rec.created_at === null) {
          createdAtStr = '';
        } else if (
          typeof rec.created_at === 'string' ||
          typeof rec.created_at === 'number'
        ) {
          createdAtStr = String(rec.created_at);
        } else if (rec.created_at instanceof Date) {
          createdAtStr = rec.created_at.toISOString();
        } else if (typeof rec.created_at === 'object') {
          try {
            createdAtStr = JSON.stringify(rec.created_at);
          } catch {
            createdAtStr = '';
          }
        } else {
          createdAtStr = '';
        }

        return {
          id: idStr,
          created_at: createdAtStr,
        };
      });
    } catch {
      return [];
    }
  }

  // helper: check if table has deleted_at column
  private async hasDeletedAtColumn(table: string): Promise<boolean> {
    try {
      const raw: unknown = await this.dataSource.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'deleted_at' LIMIT 1`,
        [table],
      );
      return Array.isArray(raw) && raw.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Remove a warehouse.
   * - If dependents exist and force === false -> throws BadRequest with details (dependentCount + sample).
   * - If force === true -> deletes dependents (soft if possible), then deletes warehouse inside a transaction.
   */
  async remove(
    id: string,
    companyId: string,
    force = false,
  ): Promise<{ deleted: boolean }> {
    // verify warehouse belongs to company
    const warehouse = await this.warehouseRepo.findOne({
      where: { id, companyId },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with id ${id} not found for company ${companyId}`,
      );
    }

    // check common dependent tables (sales, transactions)
    const dependentsTables = ['sales', 'transactions'];
    const counts: Record<string, number> = {};

    for (const t of dependentsTables) {
      counts[t] = await this.countIfTableExists(t, id);
    }

    const totalDependents = Object.values(counts).reduce((s, v) => s + v, 0);

    if (totalDependents > 0 && !force) {
      // prepare a small sample from whichever table has dependents
      let sample: Array<{ id: string; created_at: string }> = [];
      for (const t of dependentsTables) {
        if (counts[t] > 0) {
          sample = await this.sampleDependents(t, id, 5);
          break;
        }
      }

      throw new BadRequestException({
        message: `Cannot delete warehouse ${id} — ${totalDependents} dependent record(s) exist (sales/transactions).`,
        dependentCount: totalDependents,
        breakdown: counts,
        sample,
        hint: `If you really want to delete the warehouse and its dependents, call DELETE /inventory/warehouses/${id}?force=true`,
      });
    }

    // proceed with forced deletion or when there are zero dependents
    await this.dataSource.transaction(async (manager) => {
      // 1) delete dependents table-by-table
      for (const t of dependentsTables) {
        const c = counts[t];
        if (c > 0) {
          const tableHasDeletedAt = await this.hasDeletedAtColumn(t);
          if (tableHasDeletedAt) {
            // soft-delete via updating deleted_at
            await manager.query(
              `UPDATE ${t} SET deleted_at = now() WHERE "warehouseId" = $1`,
              [id],
            );
            this.logger.log(
              `Soft-deleted ${c} rows in ${t} for warehouse ${id}`,
            );
          } else {
            // hard delete
            await manager.query(`DELETE FROM ${t} WHERE "warehouseId" = $1`, [
              id,
            ]);
            this.logger.log(
              `Hard-deleted ${c} rows in ${t} for warehouse ${id}`,
            );
          }
        }
      }

      // 2) delete the warehouse (prefer softDelete if entity metadata has deleteDateColumn)
      const warehouseMeta = this.warehouseRepo.metadata;
      const warehouseHasDeleteDate = !!warehouseMeta.deleteDateColumn;

      if (warehouseHasDeleteDate) {
        await manager.getRepository(Warehouse).softDelete({ id, companyId });
      } else {
        await manager.getRepository(Warehouse).delete({ id, companyId });
      }
      this.logger.log(`Deleted warehouse ${id} for company ${companyId}`);
    });

    return { deleted: true };
  }
}
