// src/inventory/stock-level/stock-level.service.ts
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

  // CRUD
  async create(dto: CreateStockLevelDto): Promise<StockLevel> {
    const sl = this.stockLevelRepo.create(dto);
    return this.stockLevelRepo.save(sl);
  }

  async findAll(companyId: string): Promise<StockLevel[]> {
    return this.stockLevelRepo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({ where: { id } });
    if (!sl) {
      throw new NotFoundException(`StockLevel ${id} not found`);
    }
    return sl;
  }

  async update(id: string, dto: UpdateStockLevelDto): Promise<StockLevel> {
    await this.stockLevelRepo.update(id, { quantity: dto.quantity });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.stockLevelRepo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`StockLevel ${id} not found`);
    }
  }

  /**
   * Public helper to send low-stock alert via NotificationService.
   * Useful for sending alerts after transaction commit.
   */
  public async sendLowStockAlert(
    recipient: string,
    payload: { productName: string; currentQty: number },
  ) {
    await this.notificationService.sendLowStockAlert(recipient, payload);
  }

  /**
   * Adjust stock. If `manager` is provided, it participates in that transaction.
   * Returns { stock, low } where `low` is true if quantity <= threshold.
   *
   * NOTE: when called with `manager`, this method DOES NOT send notifications.
   * The caller should send notifications after the outer transaction completes.
   */
  async adjustStock(
    dto: AdjustStockDto,
    manager?: EntityManager,
  ): Promise<{ stock: StockLevel; low: boolean }> {
    const { productId, warehouseId, companyId, type, quantity, reference } =
      dto;

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
      });
      await m.save(tx);

      let sl = await m.findOne(StockLevel, {
        where: { productId, warehouseId, companyId },
        relations: ['product', 'warehouse'],
      });

      if (!sl) {
        sl = m.create(StockLevel, {
          productId,
          warehouseId,
          companyId,
          quantity: 0,
        });
      }

      sl.quantity += type === TransactionType.IN ? quantity : -quantity;
      const saved = await m.save(sl);

      const low = saved.quantity <= this.LOW_STOCK_THRESHOLD;
      return { stock: saved, low };
    };

    if (manager) {
      // participate in caller's transaction; do NOT send notifications here
      return run(manager);
    }

    // No manager => run our own transaction and handle notifications AFTER commit.
    const result = await this.dataSource.transaction(async (m) => {
      return run(m);
    });

    // transaction committed; safe to send notifications now
    if (result.low) {
      this.logger.warn(
        `Low stock for ${result.stock.product.name}: ${result.stock.quantity} <= ${this.LOW_STOCK_THRESHOLD}`,
      );
      await this.notificationService.sendLowStockAlert(this.ALERT_RECIPIENT, {
        productName: result.stock.product.name,
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

    // Use type assertion to allow 'quantity'
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
