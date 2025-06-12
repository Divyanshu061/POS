// src/inventory/inventory.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, DeepPartial } from 'typeorm';

import { CreateProductDto } from './product/dto/create-product.dto';
import { UpdateProductDto } from './product/dto/update-product.dto';
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
  ) {}

  // ─── PRODUCT CRUD ─────────────────────────────────

  findAllProducts(): Promise<Product[]> {
    return this.productRepo.find();
  }

  private parseProductId(id: string): number {
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      throw new BadRequestException(`Invalid product ID: ${id}`);
    }
    return productId;
  }

  async findProductById(id: string): Promise<Product> {
    const productId = this.parseProductId(id);
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
    return product;
  }

  createProduct(dto: CreateProductDto): Promise<Product> {
    // pick exactly the entity columns
    const partial: DeepPartial<Product> = {
      name: dto.name,
      sku: dto.sku,
      barcode: dto.barcode,
      description: dto.description,
      unitPrice: dto.unitPrice,
      companyId: dto.companyId, // string is fine here
      categoryId:
        dto.categoryId !== undefined ? String(dto.categoryId) : undefined,
      supplierId:
        dto.supplierId !== undefined ? String(dto.supplierId) : undefined,
    };

    const product = this.productRepo.create(partial);
    return this.productRepo.save(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const productId = this.parseProductId(id);
    await this.findProductById(id);

    // same flattening for update
    const partial: DeepPartial<Product> = {
      ...('name' in dto && { name: dto.name }),
      ...('sku' in dto && { sku: dto.sku }),
      ...('barcode' in dto && { barcode: dto.barcode }),
      ...('description' in dto && { description: dto.description }),
      ...('unitPrice' in dto && { unitPrice: dto.unitPrice }),
      ...('companyId' in dto && { companyId: dto.companyId }),
      ...(dto.categoryId !== undefined && {
        categoryId: String(dto.categoryId),
      }),
      ...(dto.supplierId !== undefined && {
        supplierId: String(dto.supplierId),
      }),
    };

    await this.productRepo.update(productId, partial);
    return this.findProductById(id);
  }

  async deleteProduct(id: string): Promise<void> {
    const productId = this.parseProductId(id);
    const result = await this.productRepo.delete(productId);
    if (!result.affected) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }
  }

  // ─── STOCK & TRANSACTIONS ─────────────────────────

  async adjustStock(dto: AdjustStockDto): Promise<StockLevel> {
    const txType: TransactionType =
      dto.type === StockAction.IN ? TransactionType.IN : TransactionType.OUT;

    return this.dataSource.transaction(async (manager) => {
      const tx = manager.create(Transaction, {
        productId: parseInt(dto.productId, 10),
        warehouseId: dto.warehouseId,
        companyId: dto.companyId,
        type: txType,
        quantity: dto.quantity,
        reference: dto.reference,
      });
      await manager.save(tx);

      let sl = await manager.findOne(StockLevel, {
        where: {
          productId: parseInt(dto.productId, 10),
          warehouseId: dto.warehouseId,
          companyId: dto.companyId,
        },
      });
      if (!sl) {
        sl = manager.create(StockLevel, {
          productId: parseInt(dto.productId, 10),
          warehouseId: dto.warehouseId,
          companyId: dto.companyId,
          quantity: 0,
        });
      }

      if (dto.type === StockAction.IN) {
        sl.quantity += dto.quantity;
      } else {
        if (sl.quantity < dto.quantity) {
          throw new BadRequestException(
            `Insufficient stock: have ${sl.quantity}, removing ${dto.quantity}`,
          );
        }
        sl.quantity -= dto.quantity;
      }

      return manager.save(sl);
    });
  }

  getStockLevel(productId: string, warehouseId: string): Promise<StockLevel> {
    return this.stockRepo.findOneOrFail({
      where: {
        productId: parseInt(productId, 10),
        warehouseId,
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
