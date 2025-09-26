// src/inventory/sales/sales.service.t
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

import { TransactionService } from '../transaction/transaction.service';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { StockLevelService } from '../stock-level/stock-level.service';

// Reuse the generic audit entry type expected by audit-log.service
import type { AuditLogEntry } from '../audit-log/audit-log.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    private readonly txService: TransactionService,
    private readonly audit: AuditLogService,
    private readonly stockLevelService: StockLevelService,
  ) {}

  async create(
    companyId: string,
    dto: CreateSaleDto,
    userId: string,
  ): Promise<Sale> {
    const stockChanges: Array<{
      productId: number;
      warehouseId: string;
      type: TransactionType;
      quantity: number;
      companyId: string;
    }> = [];

    // 1) Check stock & log audit for each item (use passed companyId)
    for (const item of dto.items) {
      const currentStock = await this.stockLevelService.getStockLevel(
        companyId,
        item.productId,
        dto.warehouseId,
      );

      if (currentStock.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}`,
        );
      }

      // Create a typed audit entry for stock update snapshot
      type StockSnapshot = { quantity: number };
      const beforeSnap: StockSnapshot = { quantity: currentStock.quantity };
      const afterSnap: StockSnapshot = {
        quantity: currentStock.quantity - item.quantity,
      };

      // Wrap numbers into the shape expected by AuditLogEntry<T>
      const stockAuditEntry: AuditLogEntry<{
        quantity: { before: number; after: number };
      }> = {
        entity: 'stock',
        entityId: `${item.productId}-${dto.warehouseId}`,
        action: 'UPDATE',
        user: { userId, companyId },
        // provide the typed shape: { quantity: { before, after } }
        before: {
          quantity: { before: beforeSnap.quantity, after: afterSnap.quantity },
        },
        after: null,
      };

      await this.audit.log(stockAuditEntry);

      stockChanges.push({
        productId: item.productId,
        warehouseId: dto.warehouseId,
        type: TransactionType.OUT,
        quantity: item.quantity,
        companyId,
      });
    }

    // 2) Create sale with cascade items (use companyId param)
    const totalQty = dto.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalAmtNumber = dto.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );

    // Build the Sale instance explicitly (avoids overload/type inference issues)
    const sale = new Sale();
    sale.clientId = dto.clientId;
    sale.warehouseId = dto.warehouseId;
    sale.companyId = companyId;
    sale.paymentMethod = dto.paymentMethod;
    sale.amountPaid = dto.amountPaid;
    sale.notes = dto.notes;
    sale.soldAt = dto.saleDate ? new Date(dto.saleDate) : new Date();
    sale.totalQuantity = totalQty;
    // entity uses decimal transformer — store numeric value
    sale.totalAmount = Number(totalAmtNumber.toFixed(2));

    // Create typed SaleItem instances and set companyId on each
    sale.items = dto.items.map((i) => {
      const si = new SaleItem();
      si.productId = i.productId;
      si.quantity = i.quantity;
      si.unitPrice = Number(i.unitPrice.toFixed(2));
      // Important: ensure tenant link is set on each item
      si.companyId = companyId;
      return si;
    });

    // Persist sale (cascades items)
    const saved = await this.saleRepo.save(sale);

    // Audit log for creation — log the created sale snapshot
    const saleAuditEntry: AuditLogEntry<Sale> = {
      entity: 'sale',
      entityId: String(saved.id),
      action: 'CREATE',
      user: { userId, companyId },
      before: null,
      after: saved,
    };

    await this.audit.log(saleAuditEntry);

    this.logger.log(`Sale created: ${saved.id} (company: ${companyId})`);

    // 3) Stock-out transactions + adjust stock levels
    for (const tx of stockChanges) {
      await this.txService.create(
        {
          productId: tx.productId,
          warehouseId: tx.warehouseId,
          type: TransactionType.OUT,
          quantity: tx.quantity,
          reference: `Sale#${saved.id}`,
        },
        companyId, // ✅ pass companyId to transaction service
      );

      await this.stockLevelService.adjustStock(
        {
          productId: tx.productId,
          warehouseId: tx.warehouseId,
          type: TransactionType.OUT,
          quantity: tx.quantity,
          reference: `Sale#${saved.id}`,
        },
        companyId,
        userId,
      );
    }

    return saved;
  }

  // Return all sales for a company (tenant scoped)
  findAll(companyId: string): Promise<Sale[]> {
    return this.saleRepo.find({
      where: { companyId },
      relations: ['items', 'client', 'warehouse'],
      order: { soldAt: 'DESC' },
    });
  }

  async findOne(companyId: string, id: string): Promise<Sale> {
    const sale = await this.saleRepo.findOne({
      where: { id, companyId },
      relations: ['items'],
    });
    if (!sale) {
      throw new NotFoundException(
        `Sale ${id} not found for this company (${companyId})`,
      );
    }
    return sale;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateSaleDto,
    userId?: string,
  ): Promise<Sale> {
    const existing = await this.findOne(companyId, id);
    const { items, ...header } = dto;

    const updatePayload: Partial<Sale> = { ...header };

    if (items) {
      updatePayload.totalQuantity = items.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      const totalAmtNumber = items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );
      updatePayload.totalAmount = Number(totalAmtNumber.toFixed(2));
    }

    // Ensure the update is scoped by companyId to avoid cross-tenant updates
    await this.saleRepo.update({ id, companyId }, updatePayload);

    if (items) {
      // Remove existing items (they belong to the same sale so same company)
      // We use the relation API on Sale entity to remove/add items.
      if (existing.items.length > 0) {
        await this.saleRepo
          .createQueryBuilder()
          .relation(Sale, 'items')
          .of(id)
          .remove(existing.items);
      }

      // Create new items with companyId set
      const newItems = items.map((i) => {
        const si = new SaleItem();
        si.productId = i.productId;
        si.quantity = i.quantity;
        si.unitPrice = Number(i.unitPrice.toFixed(2));
        si.companyId = companyId; // ensure tenant link
        return si;
      });

      await this.saleRepo
        .createQueryBuilder()
        .relation(Sale, 'items')
        .of(id)
        .add(newItems);

      // Adjust transactions / stock for diffs
      for (const i of items) {
        const old = existing.items.find((o) => o.productId === i.productId);
        const diffQty = i.quantity - (old?.quantity ?? 0);
        if (diffQty !== 0) {
          await this.txService.create(
            {
              productId: i.productId,
              warehouseId: dto.warehouseId ?? existing.warehouseId,
              type: TransactionType.ADJUSTMENT,
              quantity: Math.abs(diffQty),
              reference: `Adjusted Sale#${id}`,
            },
            companyId,
          );

          await this.stockLevelService.adjustStock(
            {
              productId: i.productId,
              warehouseId: dto.warehouseId ?? existing.warehouseId,
              type: diffQty > 0 ? TransactionType.OUT : TransactionType.IN,
              quantity: Math.abs(diffQty),
              reference: `Adjusted Sale#${id}`,
            },
            companyId,
            userId,
          );
        }
      }
    }

    const updated = await this.findOne(companyId, id);

    const updateAuditEntry: AuditLogEntry<Partial<Sale>> = {
      entity: 'sale',
      entityId: String(id),
      action: 'UPDATE',
      user: { userId: userId ?? 'system', companyId },
      before: existing,
      after: updated,
    };

    await this.audit.log(updateAuditEntry);

    this.logger.log(`Sale updated: ${id} (company: ${companyId})`);

    return updated;
  }

  async remove(companyId: string, id: string, userId?: string): Promise<void> {
    const sale = await this.findOne(companyId, id);

    for (const item of sale.items) {
      await this.txService.create(
        {
          productId: item.productId,
          warehouseId: sale.warehouseId,
          type: TransactionType.IN,
          quantity: item.quantity,
          reference: `Reverted Sale#${id}`,
        },
        companyId,
      );

      await this.stockLevelService.adjustStock(
        {
          productId: item.productId,
          warehouseId: sale.warehouseId,
          type: TransactionType.IN,
          quantity: item.quantity,
          reference: `Reverted Sale#${id}`,
        },
        companyId,
        userId,
      );
    }

    const deleteAuditEntry: AuditLogEntry<Sale> = {
      entity: 'sale',
      entityId: String(id),
      action: 'DELETE',
      user: { userId: userId ?? 'system', companyId },
      before: sale,
      after: null,
    };

    await this.audit.log(deleteAuditEntry);

    this.logger.log(`Sale removed: ${id} (company: ${companyId})`);

    // Scoped delete — prevents cross-tenant removal
    await this.saleRepo.delete({ id, companyId });
  }
}
