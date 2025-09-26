// src/inventory/purchase/purchase.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { StockLevelService } from '../stock-level/stock-level.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateAuditLogDto } from '../audit-log/dto/create-audit-log.dto';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    private readonly stockLevelService: StockLevelService,
    private readonly audit: AuditLogService,
  ) {}

  /** Create a new purchase, increase stock, and log */
  async create(
    companyId: string,
    dto: CreatePurchaseDto,
    userId?: string,
  ): Promise<Purchase> {
    const purchase = this.purchaseRepo.create({
      supplierId: dto.supplierId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      companyId,
    });

    try {
      const saved = await this.purchaseRepo.save(purchase);

      // stock-in
      await this.stockLevelService.adjustStock(
        {
          productId: saved.productId,
          warehouseId: saved.warehouseId,
          type: TransactionType.IN,
          quantity: saved.quantity,
          reference: `Purchase#${saved.id}`,
        },
        companyId,
        userId,
      );

      if (userId) {
        await this.audit.log({
          action: 'CREATE',
          entity: 'purchase',
          entityId: saved.id,
          userId,
          companyId,
          changes: { after: saved },
        } as CreateAuditLogDto);
      }

      return saved;
    } catch (err) {
      this.logger.error('Failed to create purchase', err as Error);
      throw new InternalServerErrorException('Failed to create purchase');
    }
  }

  /** Retrieve all purchases for a company */
  findAll(companyId: string): Promise<Purchase[]> {
    return this.purchaseRepo.find({ where: { companyId } });
  }

  /** Retrieve one purchase (scoped by company) */
  async findOne(companyId: string, id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id, companyId },
    });
    if (!purchase) throw new NotFoundException(`Purchase ${id} not found`);
    return purchase;
  }

  /** Update purchase and adjust stock */
  async update(
    companyId: string,
    id: string,
    dto: UpdatePurchaseDto,
    userId?: string,
  ): Promise<Purchase> {
    const existing = await this.findOne(companyId, id);

    const newQuantity = dto.quantity ?? existing.quantity;
    const quantityDiff = newQuantity - existing.quantity;

    await this.purchaseRepo.update(
      { id, companyId },
      {
        quantity: newQuantity,
        unitCost: dto.unitCost ?? existing.unitCost,
      },
    );

    const updated = await this.findOne(companyId, id);

    await this.stockLevelService.adjustStock(
      {
        productId: updated.productId,
        warehouseId: updated.warehouseId,
        type: quantityDiff >= 0 ? TransactionType.IN : TransactionType.OUT,
        quantity: Math.abs(quantityDiff),
        reference: `Purchase#${updated.id}`,
      },
      companyId,
      userId,
    );

    if (userId) {
      await this.audit.log({
        action: 'UPDATE',
        entity: 'purchase',
        entityId: updated.id,
        userId,
        companyId,
        changes: { before: existing, after: updated },
      } as CreateAuditLogDto);
    }

    return updated;
  }

  /** Delete purchase and reverse stock */
  async remove(companyId: string, id: string, userId?: string): Promise<void> {
    const existing = await this.findOne(companyId, id);

    await this.stockLevelService.adjustStock(
      {
        productId: existing.productId,
        warehouseId: existing.warehouseId,
        type: TransactionType.OUT,
        quantity: existing.quantity,
        reference: `RevertPurchase#${existing.id}`,
      },
      companyId,
      userId,
    );

    await this.purchaseRepo.delete({ id, companyId });

    if (userId) {
      await this.audit.log({
        action: 'DELETE',
        entity: 'purchase',
        entityId: id,
        userId,
        companyId,
      } as CreateAuditLogDto);
    }
  }
}
