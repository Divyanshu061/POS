// src/inventory/stock-level/stock-level.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';

import { StockLevel } from './entities/stock-level.entity';
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

  // ─── STOCK FEATURES ──────────────────────────────

  /**
   * Adjust stock by creating a Transaction record AND updating StockLevel,
   * all within a single DB transaction for consistency.
   */
  async adjustStock(dto: AdjustStockDto): Promise<StockLevel> {
    const { productId, warehouseId, companyId, type, quantity, reference } =
      dto;

    // 1) enum‐safety check
    if (!Object.values(TransactionType).includes(type)) {
      throw new BadRequestException(`Unknown transaction type "${type}"`);
    }

    return this.dataSource.transaction(async (manager) => {
      // 2) create & save Transaction
      const tx = manager.create(Transaction, {
        productId,
        warehouseId,
        companyId,
        type,
        quantity,
        reference,
      });
      await manager.save(tx);

      // 3) fetch or create StockLevel
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

      // 4) adjust quantity
      if (type === TransactionType.IN) {
        sl.quantity += quantity;
      } /* OUT */ else {
        sl.quantity -= quantity;
      }

      // 5) save & return
      return manager.save(sl);
    });
  }

  /**
   * Get the current StockLevel for one product/warehouse.
   */
  async getStockLevel(
    companyId: string,
    productId: string,
    warehouseId: string,
  ): Promise<StockLevel> {
    const sl = await this.stockLevelRepo.findOne({
      where: { productId, warehouseId },
    });

    if (!sl) {
      throw new NotFoundException(
        `No stock found for product ${productId} in warehouse ${warehouseId} under company ${companyId}`,
      );
    }
    return sl;
  }

  /**
   * Low-stock report: all entries at or below threshold.
   */
  async lowStockReport(
    companyId: string,
    threshold = 10,
  ): Promise<StockLevel[]> {
    return this.stockLevelRepo.find({
      where: {
        companyId,
        quantity: LessThanOrEqual(threshold),
      },
      relations: ['product', 'warehouse'],
    });
  }
}
