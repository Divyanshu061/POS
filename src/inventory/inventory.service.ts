// src/inventory/inventory.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, StockAction } from './dto/adjust-stock.dto';

import { Product } from './product/entities/product.entity';
import { StockLevel } from './stock-level/entities/stock-level.entity';
import {
  Transaction,
  TransactionType,
} from './transaction/entities/transaction.entity';

@Injectable()
export class InventoryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>, // can remove if truly unused
  ) {}

  // ─── PRODUCT CRUD ─────────────────────────────────

  findAllProducts(): Promise<Product[]> {
    return this.productRepo.find();
  }

  async findProductById(id: string): Promise<Product> {
    const idNum = Number(id);
    const product = await this.productRepo.findOne({ where: { id: idNum } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  createProduct(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findProductById(id);
    const idNum = Number(id);
    await this.productRepo.update(idNum, dto);
    return this.findProductById(id);
  }

  async deleteProduct(id: string): Promise<void> {
    const idNum = Number(id);
    const result = await this.productRepo.delete(idNum);
    if (!result.affected) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }

  // ─── STOCK & TRANSACTIONS ─────────────────────────

  async adjustStock(dto: AdjustStockDto): Promise<StockLevel> {
    const productIdNum = Number(dto.productId);
    const warehouseIdNum = Number(dto.warehouseId);

    const txType: TransactionType =
      dto.type === StockAction.IN ? TransactionType.IN : TransactionType.OUT;

    return this.dataSource.transaction(async (manager) => {
      // Step 1: Create transaction record
      const transaction = manager.create(Transaction, {
        productId,
        warehouseId,
        companyId: dto.companyId,
        type: txType,
        quantity: dto.quantity,
        reference: dto.reference || null,
      });
      await manager.save(transaction);

      // 2) Find or create the stock level
      let sl = await manager.findOne(StockLevel, {
        where: {
          productId: productIdNum,
          warehouseId: warehouseIdNum,
          companyId: dto.companyId,
        },
      });
      if (!sl) {
        sl = manager.create(StockLevel, {
          productId: productIdNum,
          warehouseId: warehouseIdNum,
          companyId: dto.companyId,
          quantity: 0,
        });
      }

      // 3) Adjust quantity
      if (dto.type === StockAction.IN) {
        sl.quantity += dto.quantity;
      } else {
        if (sl.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient stock: have ${sl.quantity}, trying to remove ${dto.quantity}`,
          );
        }
        sl.quantity -= dto.quantity;
      }

      // 4) Persist & return
      return manager.save(sl);
    });
  }

  getStockLevel(productId: string, warehouseId: string): Promise<StockLevel> {
    const productIdNum = Number(productId);
    const warehouseIdNum = Number(warehouseId);
    return this.stockRepo.findOneOrFail({
      where: {
        productId: productIdNum,
        warehouseId: warehouseIdNum,
      },
    });
  }

  async findLowStock(threshold: number): Promise<Product[]> {
    const lowStocks = await this.stockRepo.find({
      where: { quantity: LessThanOrEqual(threshold) },
      relations: ['product'],
    });
    return lowStocks.map((sl) => sl.product);
  }
}
