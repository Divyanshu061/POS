// File: src/payment-invoice/invoice-line-item.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { UpdateInvoiceLineItemDto } from './dto/update-invoice-line-item.dto';

@Injectable()
export class InvoiceLineItemService {
  constructor(
    @InjectRepository(InvoiceLineItem)
    private readonly itemRepo: Repository<InvoiceLineItem>,
  ) {}

  async create(
    invoiceId: string,
    dto: CreateInvoiceLineItemDto,
  ): Promise<InvoiceLineItem> {
    const item = this.itemRepo.create({
      invoiceId,
      description: dto.description,
      unitPrice: dto.unitPrice.toFixed(2),
      quantity: dto.quantity,
      lineTotal: (dto.unitPrice * dto.quantity).toFixed(2),
    });
    return this.itemRepo.save(item);
  }

  async findAll(invoiceId: string): Promise<InvoiceLineItem[]> {
    return this.itemRepo.find({ where: { invoiceId } });
  }

  async createMany(
    invoiceId: string,
    dtoArray: CreateInvoiceLineItemDto[],
  ): Promise<InvoiceLineItem[]> {
    const items = dtoArray.map((dto) =>
      this.itemRepo.create({
        invoiceId,
        description: dto.description,
        unitPrice: dto.unitPrice.toFixed(2),
        quantity: dto.quantity,
        lineTotal: (dto.unitPrice * dto.quantity).toFixed(2),
      }),
    );

    return this.itemRepo.save(items);
  }

  async findOne(id: string): Promise<InvoiceLineItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Line item not found');
    return item;
  }

  async update(
    id: string,
    dto: UpdateInvoiceLineItemDto,
  ): Promise<InvoiceLineItem> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    if (dto.unitPrice !== undefined || dto.quantity !== undefined) {
      const price = dto.unitPrice ?? parseFloat(item.unitPrice);
      const qty = dto.quantity ?? item.quantity;
      item.lineTotal = (price * qty).toFixed(2);
    }
    return this.itemRepo.save(item);
  }

  async remove(id: string): Promise<void> {
    const res = await this.itemRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Line item not found');
  }
}
