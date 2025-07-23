import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

import { TransactionService } from '../transaction/transaction.service';
import { TransactionType } from '../transaction/entities/transaction.entity';
import { Product } from '../product/entities/product.entity';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly txService: TransactionService,
    private readonly audit: AuditLogService,
  ) {}

  async create(dto: CreateSaleDto, userId: string): Promise<Sale> {
    const stockChanges: Array<{
      productId: number;
      warehouseId: string;
      type: TransactionType;
      quantity: number;
      companyId: string;
    }> = [];

    // 1) Check stock & log audit
    for (const item of dto.items) {
      const prod = await this.productRepo.findOne({
        where: { id: item.productId },
      });
      if (!prod)
        throw new NotFoundException(`Product ${item.productId} not found`);
      if ((prod.quantity ?? 0) < item.quantity)
        throw new BadRequestException(
          `Insufficient stock for product ${item.productId}`,
        );

      const beforeQty = prod.quantity;
      prod.quantity -= item.quantity;
      await this.productRepo.save(prod);

      await this.audit.log({
        action: 'UPDATE',
        entity: 'product',
        entityId: prod.id.toString(),
        userId,
        changes: { quantity: { before: beforeQty, after: prod.quantity } },
      });

      stockChanges.push({
        productId: prod.id,
        warehouseId: dto.warehouseId,
        type: TransactionType.OUT,
        quantity: item.quantity,
        companyId: dto.companyId,
      });
    }

    // 2) Create sale with cascade items
    const sale = this.saleRepo.create({
      clientId: dto.clientId,
      warehouseId: dto.warehouseId,
      companyId: dto.companyId,
      paymentMethod: dto.paymentMethod,
      amountPaid: dto.amountPaid,
      notes: dto.notes,
      soldAt: new Date(dto.saleDate),
      totalQuantity: dto.items.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: dto.items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      ),
      items: dto.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    });

    const saved = await this.saleRepo.save(sale);

    // 3) Stock-out transactions
    for (const tx of stockChanges) {
      await this.txService.create({
        ...tx,
        reference: `Sale#${saved.id}`,
      });
    }

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
    const { items, ...header } = dto;

    // Update header
    const updatePayload: Partial<Sale> = { ...header };
    if (items) {
      updatePayload.totalQuantity = items.reduce(
        (sum, i) => sum + i.quantity,
        0,
      );
      updatePayload.totalAmount = items.reduce(
        (sum, i) => sum + i.unitPrice * i.quantity,
        0,
      );
    }

    await this.saleRepo.update(id, updatePayload);

    // Replace items if changed
    if (items) {
      // clear old
      await this.saleRepo
        .createQueryBuilder()
        .relation(Sale, 'items')
        .of(id)
        .remove(existing.items);

      // add new
      const newItems = items.map((i) => {
        const si = new SaleItem();
        si.productId = i.productId;
        si.quantity = i.quantity;
        si.unitPrice = i.unitPrice;
        return si;
      });
      await this.saleRepo
        .createQueryBuilder()
        .relation(Sale, 'items')
        .of(id)
        .add(newItems);

      // log adjustments
      for (const i of items) {
        const old = existing.items.find((o) => o.productId === i.productId);
        const diffQty = i.quantity - (old?.quantity ?? 0);
        if (diffQty !== 0) {
          await this.txService.create({
            productId: i.productId,
            warehouseId: dto.warehouseId ?? existing.warehouseId,
            type: TransactionType.ADJUSTMENT,
            quantity: Math.abs(diffQty),
            reference: `Adjusted Sale#${id}`,
            companyId: existing.companyId,
          });
        }
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);

    // Revert per-item stock
    for (const item of sale.items) {
      const prod = await this.productRepo.findOne({
        where: { id: item.productId },
      });
      if (prod) {
        prod.quantity += item.quantity;
        await this.productRepo.save(prod);
      }

      await this.txService.create({
        productId: item.productId,
        warehouseId: sale.warehouseId,
        type: TransactionType.IN,
        quantity: item.quantity,
        reference: `Reverted Sale#${id}`,
        companyId: sale.companyId,
      });
    }

    await this.saleRepo.delete(id);
  }
}
