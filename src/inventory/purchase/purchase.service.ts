// src/inventory/purchase/purchase.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { StockLevelService } from '../stock-level/stock-level.service';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly stockLevelService: StockLevelService,
  ) {}

  /**
   * Create a new purchase, increase stock, and log a transaction.
   */
  async create(dto: CreatePurchaseDto): Promise<Purchase> {
    const purchase = this.purchaseRepo.create({
      supplierId: dto.supplierId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      companyId: dto.companyId,
    });

    const saved = await this.purchaseRepo.save(purchase);

    // Delegate stock-IN entirely to StockLevelService
    await this.stockLevelService.adjustStock({
      productId: saved.productId,
      warehouseId: saved.warehouseId,
      companyId: saved.companyId,
      type: TransactionType.IN,
      quantity: saved.quantity,
      reference: `Purchase#${saved.id}`,
    });

    return saved;
  }

  /**
   * Retrieve all purchases for a company.
   */
  findAll(companyId: string): Promise<Purchase[]> {
    return this.purchaseRepo.find({ where: { companyId } });
  }

  /**
   * Retrieve a specific purchase by ID.
   */
  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({ where: { id } });
    if (!purchase) {
      throw new NotFoundException(`Purchase ${id} not found`);
    }
    return purchase;
  }

  /**
   * Update a purchase record and adjust stock accordingly.
   */
  async update(id: string, dto: UpdatePurchaseDto): Promise<Purchase> {
    const existing = await this.findOne(id);

    // Calculate how many units have changed
    const newQuantity = dto.quantity ?? existing.quantity;
    const quantityDiff = newQuantity - existing.quantity;

    await this.purchaseRepo.update(id, {
      quantity: newQuantity,
      unitCost: dto.unitCost ?? existing.unitCost,
    });

    const updated = await this.findOne(id);

    // Delegate the IN or OUT adjustment based on diff sign
    await this.stockLevelService.adjustStock({
      productId: updated.productId,
      warehouseId: updated.warehouseId,
      companyId: updated.companyId,
      type: quantityDiff >= 0 ? TransactionType.IN : TransactionType.OUT,
      quantity: Math.abs(quantityDiff),
      reference: `Purchase#${updated.id}`,
    });

    return updated;
  }

  /**
   * Delete a purchase and reverse its stock effect.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);

    // Reverse the original purchase quantities
    await this.stockLevelService.adjustStock({
      productId: existing.productId,
      warehouseId: existing.warehouseId,
      companyId: existing.companyId,
      type: TransactionType.OUT,
      quantity: existing.quantity,
      reference: `RevertPurchase#${existing.id}`,
    });

    await this.purchaseRepo.delete(id);
  }
}
