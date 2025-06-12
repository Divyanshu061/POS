// src/inventory/sales/sales.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from './entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

import { TransactionService } from '../transaction/transaction.service';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>, // ← inject Product repo

    private readonly txService: TransactionService,
  ) {}

  async create(dto: CreateSaleDto): Promise<Sale> {
    // 1) Check product existence and quantity
    const product = await this.productRepo.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    if ((product.quantity || 0) < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${dto.productId}`,
      );
    }

    // 2) Decrease product quantity
    product.quantity -= dto.quantity;
    await this.productRepo.save(product);

    // 3) Save the sale record
    const sale = this.saleRepo.create({ ...dto });
    const saved = await this.saleRepo.save(sale);

    // 4) Automatically record a stock-OUT transaction
    await this.txService.create({
      productId: saved.productId,
      warehouseId: saved.warehouseId,
      type: TransactionType.OUT,
      quantity: saved.quantity,
      reference: `Sale#${saved.id}`,
      companyId: saved.companyId,
    });

    return saved;
  }

  findAll(companyId: string): Promise<Sale[]> {
    return this.saleRepo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const existing = await this.findOne(id);
    await this.saleRepo.update(id, { ...dto });
    const updated = await this.findOne(id);

    const diff = (dto.quantity ?? existing.quantity) - existing.quantity;
    if (diff !== 0) {
      await this.txService.create({
        productId: updated.productId,
        warehouseId: dto.warehouseId ?? updated.warehouseId,
        type: TransactionType.ADJUSTMENT,
        quantity: Math.abs(diff),
        reference: `Adjusted Sale#${id}`,
        companyId: updated.companyId,
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);

    // Revert product quantity
    const product = await this.productRepo.findOne({
      where: { id: existing.productId },
    });
    if (product) {
      product.quantity += existing.quantity;
      await this.productRepo.save(product);
    }

    // Record a reversal stock-IN transaction
    await this.txService.create({
      productId: existing.productId,
      warehouseId: existing.warehouseId,
      type: TransactionType.IN,
      quantity: existing.quantity,
      reference: `Reverted Sale#${id}`,
      companyId: existing.companyId,
    });

    // Delete the sale record
    await this.saleRepo.delete(id);
  }
}
