// File: src/inventory/stock-level/stock-level.service.ts
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
  LessThanOrEqual,
  Not,
  In,
  FindOptionsWhere,
  FindOperator,
  EntityManager,
  DeepPartial,
} from 'typeorm';

import { StockLevel } from './entities/stock-level.entity';
import { Product } from '../product/entities/product.entity';
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

  // Create stock-level record for the given company (tenant enforced)
  // Accept optional userId for audit
  async create(
    dto: CreateStockLevelDto,
    companyId: string,
    userId?: string,
  ): Promise<StockLevel> {
    // Build a payload typed for TypeORM create/save. Avoid passing `null` for optional props;
    // use `undefined` so DeepPartial<string|undefined> matches.
    const payload: Partial<StockLevel> = {
      ...dto,
      companyId,
      createdBy: userId ?? undefined,
    };

    // Cast to DeepPartial to satisfy the create() overloads
    const sl = this.stockLevelRepo.create(payload as DeepPartial<StockLevel>);
    return this.stockLevelRepo.save(sl);
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

  // Update (tenant-enforced). Accept optional userId for audit.
  async update(
    id: string,
    dto: UpdateStockLevelDto,
    companyId: string,
    userId?: string,
  ): Promise<StockLevel> {
    const sl = await this.findOne(id, companyId); // ensures tenant access

    if (dto.quantity !== undefined) {
      sl.quantity = dto.quantity;
    }
    if (dto.reorderLevel !== undefined) {
      sl.reorderLevel = dto.reorderLevel;
    }

    if (userId) {
      sl.updatedBy = userId;
    }

    return this.stockLevelRepo.save(sl);
  }

  // Remove (tenant-enforced). Accept optional userId for audit (we log it here).
  async remove(id: string, companyId: string, _userId?: string): Promise<void> {
    // optional audit log so _userId is not unused (helps satisfy eslint)
    if (_userId) {
      this.logger.debug(`StockLevel.remove called by user ${_userId}`);
    }

    const sl = await this.findOne(id, companyId); // will throw if not found / inaccessible
    await this.stockLevelRepo.remove(sl);
  }

  public async sendLowStockAlert(
    recipient: string,
    payload: { productName: string; currentQty: number },
  ) {
    await this.notificationService.sendLowStockAlert(recipient, payload);
  }

  /**
   * Adjust stock.
   * Note: signature unchanged from your original (dto, companyId, manager?)
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

    const run = async (m: EntityManager) => {
      const tx = m.create(Transaction, {
        productId,
        warehouseId,
        companyId,
        type,
        quantity,
        reference,
        createdBy: userId ?? undefined,
      });
      await m.save(tx);

      const qb = m.createQueryBuilder(StockLevel, 'sl');
      qb.setLock('pessimistic_write')
        .where('sl.productId = :productId', { productId })
        .andWhere('sl.warehouseId = :warehouseId', { warehouseId })
        .andWhere('sl.companyId = :companyId', { companyId });

      const existing = await qb.getOne();

      let working: StockLevel;
      if (!existing) {
        working = m.create(StockLevel, {
          productId,
          warehouseId,
          companyId,
          quantity: 0,
        });
      } else {
        working = existing;
      }

      working.quantity += type === TransactionType.IN ? quantity : -quantity;

      if (working.quantity < 0) {
        throw new BadRequestException('Insufficient stock for this operation');
      }

      const saved = await m.save(working);

      const savedWithRelations = await m.findOne(StockLevel, {
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

    if (manager) {
      return run(manager);
    }

    const result = await this.dataSource.transaction(async (m) => run(m));

    if (result.low) {
      const productName =
        result.stock.product?.name ?? `product:${result.stock.productId}`;
      this.logger.warn(
        `Low stock for ${productName}: ${result.stock.quantity} <= ${this.LOW_STOCK_THRESHOLD}`,
      );
      await this.notificationService.sendLowStockAlert(this.ALERT_RECIPIENT, {
        productName,
        currentQty: result.stock.quantity,
      });
    }

    return result;
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
      quantity: LessThanOrEqual(threshold),
    } as FindOptionsWhere<Product>;

    if (existingProductIds.size > 0) {
      productWhere.id = Not(
        In(Array.from(existingProductIds)),
      ) as FindOperator<number>;
    }

    const lowByProduct = await this.productRepo.find({ where: productWhere });
    const fallbackEntries = lowByProduct.map((p) => ({
      product: p,
      warehouse: null,
    }));

    return [...lowStockLevels, ...fallbackEntries];
  }
}
