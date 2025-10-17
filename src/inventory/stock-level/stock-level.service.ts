import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  LessThanOrEqual,
  Not,
  In,
  FindOptionsWhere,
  FindOperator,
  DeepPartial,
} from 'typeorm';

import { StockLevel } from './entities/stock-level.entity';
import { Product } from '../product/entities/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Company } from '../company/entities/company.entity';
import { CreateStockLevelDto } from './dto/create-stock-level.dto';
import { UpdateStockLevelDto } from './dto/update-stock-level.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

import {
  Transaction,
  TransactionType,
} from '../transaction/entities/transaction.entity';

import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StockLevelService {
  private readonly logger = new Logger(StockLevelService.name);
  private readonly LOW_STOCK_THRESHOLD: number;
  private readonly ALERT_RECIPIENT: string;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    this.LOW_STOCK_THRESHOLD = this.configService.get<number>(
      'LOW_STOCK_THRESHOLD',
      10,
    );
    this.ALERT_RECIPIENT = this.configService.get<string>(
      'LOW_STOCK_ALERT_EMAIL',
      'procurement@yourcompany.com',
    );
  }

  /**
   * Safely extract Postgres error code from an unknown error.
   * Returns the code string (e.g., '23503') or undefined.
   */
  private getPgErrorCode(err: unknown): string | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const maybe = err as Record<string, unknown>;
    const code = maybe.code;
    return typeof code === 'string' ? code : undefined;
  }

  // Create stock-level record for the given company (tenant enforced)
  async create(
    dto: CreateStockLevelDto,
    companyId: string,
    userId?: string,
  ): Promise<StockLevel> {
    // validate parents early and return friendly errors
    const product = await this.productRepo.findOne({
      where: { id: dto.productId, companyId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product ${dto.productId} not found for company ${companyId}`,
      );
    }

    const warehouse = await this.warehouseRepo.findOne({
      where: { id: dto.warehouseId, companyId },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse ${dto.warehouseId} not found for company ${companyId}`,
      );
    }

    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });
    if (!company) {
      throw new BadRequestException(`Company ${companyId} not found`);
    }

    // Prevent duplicates at service level (unique index exists in DB)
    const existing = await this.stockLevelRepo.findOne({
      where: {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        companyId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'StockLevel already exists for this product+warehouse+company. Use adjust or update instead.',
      );
    }

    const payload: DeepPartial<StockLevel> = {
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      companyId,
      quantity: Math.max(0, Math.trunc(dto.quantity ?? 0)),
      reorderLevel: dto.reorderLevel ?? 10,
      createdBy: userId ?? undefined,
    };

    const sl = this.stockLevelRepo.create(payload);
    try {
      return await this.stockLevelRepo.save(sl);
    } catch (err) {
      const code = this.getPgErrorCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'Referenced product/warehouse/company does not exist',
        );
      }
      if (code === '23502') {
        throw new BadRequestException(
          'Attempted to set a required field to null',
        );
      }
      throw err;
    }
  }

  // Return all stock-levels for a company
  async findAll(companyId: string): Promise<StockLevel[]> {
    return this.stockLevelRepo.find({
      where: { companyId },
      relations: ['product', 'warehouse'],
    });
  }

  // Tenant-aware findOne
  async findOne(id: string, companyId: string): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({
      where: { id, companyId },
      relations: ['product', 'warehouse'],
    });
    if (!sl) {
      throw new NotFoundException(
        `StockLevel ${id} not found or not accessible for company ${companyId}`,
      );
    }
    return sl;
  }

  // Update (tenant-enforced) - targeted update to avoid touching FKs
  async update(
    id: string,
    dto: UpdateStockLevelDto,
    companyId: string,
    userId?: string,
  ): Promise<StockLevel> {
    // ensure the row exists and belongs to tenant
    const existing = await this.findOne(id, companyId);

    // build a partial update object — only defined scalar fields
    const toUpdate: Partial<StockLevel> = {};

    if (dto.quantity !== undefined) {
      if (dto.quantity === null)
        throw new BadRequestException('quantity cannot be null');
      toUpdate.quantity = Math.trunc(dto.quantity);
    }
    if (dto.reorderLevel !== undefined) {
      if (dto.reorderLevel === null)
        throw new BadRequestException('reorderLevel cannot be null');
      toUpdate.reorderLevel = Math.trunc(dto.reorderLevel);
    }
    if (userId) toUpdate.updatedBy = userId;

    // nothing to change -> return existing
    if (Object.keys(toUpdate).length === 0) {
      return existing;
    }

    try {
      // Use repository.update to avoid touching relations/foreign keys
      await this.stockLevelRepo.update({ id, companyId }, toUpdate);
    } catch (err) {
      const code = this.getPgErrorCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'Referenced product/warehouse/company does not exist',
        );
      }
      if (code === '23502') {
        throw new BadRequestException(
          'Attempted to set a required field to null',
        );
      }
      throw err;
    }

    // return fresh record with relations
    return this.findOne(id, companyId);
  }

  async listForWarehouse(
    companyId: string,
    warehouseId: string,
    opts?: { productId?: number; page?: number; limit?: number },
  ): Promise<{
    items: StockLevel[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, opts?.page ?? 1);
    const limit = Math.max(1, Math.min(100, opts?.limit ?? 10));
    const productId = opts?.productId;

    const qb = this.stockLevelRepo
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.product', 'product')
      .leftJoinAndSelect('sl.warehouse', 'warehouse')
      .where('sl.companyId = :companyId', { companyId })
      .andWhere('sl.warehouseId = :warehouseId', { warehouseId });

    if (productId !== undefined && productId !== null) {
      qb.andWhere('sl.productId = :productId', { productId });
    }

    const total = await qb.getCount();

    const items = await qb
      .orderBy('product.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items, total, page, limit };
  }

  // Remove (tenant-enforced)
  async remove(id: string, companyId: string, _userId?: string): Promise<void> {
    if (_userId)
      this.logger.debug(`StockLevel.remove called by user ${_userId}`);

    const sl = await this.findOne(id, companyId);
    await this.stockLevelRepo.remove(sl);
  }

  public async sendLowStockAlert(
    recipient: string,
    payload: { productName: string; currentQty: number },
  ) {
    // keep call async but do not block callers if notification fails
    try {
      await this.notificationService.sendLowStockAlert(recipient, payload);
    } catch (err) {
      this.logger.error('Failed to send low stock alert', err as Error);
    }
  }

  /**
   * Adjust stock.
   * - creates a Transaction row
   * - finds-or-creates StockLevel row and applies update inside a transaction + lock
   * - rejects negative stock (business rule)
   * - sends low-stock alert if threshold crossed
   */
  async adjustStock(
    dto: AdjustStockDto,
    companyId: string,
    userId?: string,
    manager?: EntityManager,
  ): Promise<{ stock: StockLevel; low: boolean }> {
    const { productId, warehouseId, type, quantity, reference } = dto;

    if (!Object.values(TransactionType).includes(type)) {
      throw new BadRequestException(`Unknown transaction type "${type}"`);
    }

    // validate parents before opening transaction (gives friendly errors early)
    const product = await this.productRepo.findOne({
      where: { id: productId, companyId },
    });
    if (!product)
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );

    const warehouse = await this.warehouseRepo.findOne({
      where: { id: warehouseId, companyId },
    });
    if (!warehouse)
      throw new NotFoundException(
        `Warehouse ${warehouseId} not found for company ${companyId}`,
      );

    const run = async (m: EntityManager) => {
      // create transaction record (audit)
      const txRepo = m.getRepository(Transaction);
      const tx = txRepo.create({
        productId,
        warehouseId,
        companyId,
        type,
        quantity,
        reference,
        createdBy: userId ?? undefined,
      });
      await txRepo.save(tx);

      // lock/select the stock level row
      const repo = m.getRepository(StockLevel);
      const qb = repo.createQueryBuilder('sl');
      qb.setLock('pessimistic_write')
        .where('sl.productId = :productId', { productId })
        .andWhere('sl.warehouseId = :warehouseId', { warehouseId })
        .andWhere('sl.companyId = :companyId', { companyId });

      const existing = await qb.getOne();

      let working: StockLevel;
      if (!existing) {
        working = repo.create({
          productId,
          warehouseId,
          companyId,
          quantity: 0,
          reorderLevel: 10,
        });
      } else {
        working = existing;
      }

      // apply change
      const delta = type === TransactionType.IN ? quantity : -quantity;
      const newQty = (working.quantity ?? 0) + delta;
      if (newQty < 0) {
        throw new BadRequestException('Insufficient stock for this operation');
      }

      working.quantity = Math.trunc(newQty);
      if (userId) working.updatedBy = userId;

      const saved = await repo.save(working);

      const savedWithRelations = await repo.findOne({
        where: { id: saved.id },
        relations: ['product', 'warehouse'],
      });

      const finalQty = savedWithRelations
        ? savedWithRelations.quantity
        : saved.quantity;
      const low = finalQty <= this.LOW_STOCK_THRESHOLD;

      return {
        stock: savedWithRelations ?? saved,
        low,
      };
    };

    // run in provided manager (for higher-level transactions) or open one
    try {
      const result = manager
        ? await run(manager)
        : await this.dataSource.transaction(async (m) => run(m));

      if (result.low) {
        const productName =
          result.stock.product?.name ?? `product:${result.stock.productId}`;
        this.logger.warn(
          `Low stock for ${productName}: ${result.stock.quantity} <= ${this.LOW_STOCK_THRESHOLD}`,
        );
        // fire-and-forget alert (we await but catch internally in sendLowStockAlert)
        await this.sendLowStockAlert(this.ALERT_RECIPIENT, {
          productName,
          currentQty: result.stock.quantity,
        });
      }

      return result;
    } catch (err) {
      const code = this.getPgErrorCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'Referenced product/warehouse/company does not exist',
        );
      }
      if (code === '23502') {
        throw new BadRequestException(
          'Attempted to set a required field to null',
        );
      }
      throw err;
    }
  }

  async getStockLevel(
    companyId: string,
    productId: number,
    warehouseId: string,
  ): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({
      where: {
        companyId,
        productId,
        warehouseId,
      },
      relations: ['product', 'warehouse'],
    });
    if (!sl) {
      throw new NotFoundException(
        `No stock found for product ${productId} in warehouse ${warehouseId} under company ${companyId}`,
      );
    }
    return sl;
  }

  async lowStockReport(
    companyId: string,
    threshold: number = this.LOW_STOCK_THRESHOLD,
  ): Promise<(StockLevel | { product: Product; warehouse: null })[]> {
    const lowStockLevels = await this.stockLevelRepo.find({
      where: { companyId, quantity: LessThanOrEqual(threshold) },
      relations: ['product', 'warehouse'],
    });

    const existingProductIds = new Set<number>(
      lowStockLevels.map((sl) => sl.productId),
    );

    const productWhere = {
      companyId,
    } as FindOptionsWhere<Product>;

    // fetch products that are low but have no stock_levels rows (e.g., never stocked)
    productWhere.id =
      existingProductIds.size > 0
        ? (Not(In(Array.from(existingProductIds))) as FindOperator<number>)
        : (undefined as unknown as FindOperator<number>);

    const lowByProduct =
      existingProductIds.size > 0
        ? await this.productRepo.find({ where: productWhere })
        : [];

    const fallbackEntries = lowByProduct.map((p) => ({
      product: p,
      warehouse: null,
    }));

    return [...lowStockLevels, ...fallbackEntries];
  }
}
