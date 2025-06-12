// src/inventory/stock-level/stock-level.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  LessThanOrEqual,
  Not,
  In,
  FindOptionsWhere,
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

@Injectable()
export class StockLevelService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(StockLevel)
    private readonly stockLevelRepo: Repository<StockLevel>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  // ─── CRUD ──────────────────────────────

  async create(dto: CreateStockLevelDto): Promise<StockLevel> {
    const sl = this.stockLevelRepo.create(dto);
    return this.stockLevelRepo.save(sl);
  }

  findAll(companyId: string): Promise<StockLevel[]> {
    return this.stockLevelRepo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({ where: { id } });
    if (!sl) throw new NotFoundException(`StockLevel ${id} not found`);
    return sl;
  }

  async update(id: string, dto: UpdateStockLevelDto): Promise<StockLevel> {
    await this.stockLevelRepo.update(id, { quantity: dto.quantity });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.stockLevelRepo.delete(id);
  }

  // ─── STOCK FEATURES ────────────────────

  /**
   * Adjust stock by creating a Transaction record AND updating StockLevel,
   * all within a single DB transaction for consistency.
   */
  async adjustStock(dto: AdjustStockDto): Promise<StockLevel> {
    const { productId, warehouseId, companyId, type, quantity, reference } =
      dto;

    if (!Object.values(TransactionType).includes(type)) {
      throw new BadRequestException(`Unknown transaction type "${type}"`);
    }

    return this.dataSource.transaction(async (manager) => {
      // 1) create & save Transaction
      const tx = manager.create(Transaction, {
        productId,
        warehouseId,
        companyId,
        type,
        quantity,
        reference,
      });
      await manager.save(tx);

      // 2) fetch or create StockLevel
      let sl = await manager.findOne(StockLevel, {
        where: { productId, warehouseId, companyId },
      });
      if (!sl) {
        sl = manager.create(StockLevel, {
          productId,
          warehouseId,
          companyId,
          quantity: 0,
        });
      }

      // 3) adjust quantity
      if (type === TransactionType.IN) {
        sl.quantity += quantity;
      } else {
        sl.quantity -= quantity;
      }

      // 4) save & return
      return manager.save(sl);
    });
  }

  /**
   * Get the current StockLevel for one product/warehouse.
   */
  async getStockLevel(
    companyId: string,
    productId: number,
    warehouseId: string,
  ): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({
      where: { productId, warehouseId, companyId },
    });

    if (!sl) {
      throw new NotFoundException(
        `No stock found for product ${productId} in warehouse ${warehouseId} under company ${companyId}`,
      );
    }
    return sl;
  }

  /**
   * Low-stock report:
   * 1) return all StockLevel rows where quantity ≤ threshold
   * 2) also return any Products (for this company) whose own product.quantity ≤ threshold
   *    but have no corresponding StockLevel row already returned
   */
  async lowStockReport(
    companyId: string,
    threshold = 10,
  ): Promise<(StockLevel | { product: Product; warehouse: null })[]> {
    // 1) Find all stock levels at or below threshold
    const lowStockLevels: StockLevel[] = await this.stockLevelRepo.find({
      where: {
        companyId,
        quantity: LessThanOrEqual(threshold),
      },
      relations: ['product', 'warehouse'],
    });

    // 2) Collect productIds that already have a low-stock entry
    const existingProductIds = new Set<number>(
      lowStockLevels.map((sl: StockLevel) => sl.productId),
    );

    // 3) Build where-clause for products whose own quantity ≤ threshold
    const productWhere: FindOptionsWhere<Product> = {
      companyId,
      quantity: LessThanOrEqual(threshold),
    };
    if (existingProductIds.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      productWhere.id = Not(In(Array.from(existingProductIds))) as any;
    }

    // 4) Fetch those products
    const lowByProduct: Product[] = await this.productRepo.find({
      where: productWhere,
      relations: ['category', 'supplier'],
    });

    // 5) Map to fallback entries (warehouse: null)
    const fallbackEntries: { product: Product; warehouse: null }[] =
      lowByProduct.map((p: Product) => ({
        product: p,
        warehouse: null,
      }));

    // 6) Return combined list
    return [...lowStockLevels, ...fallbackEntries];
  }
}
