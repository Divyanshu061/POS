// src/payment-invoice/invoice-line-item.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { UpdateInvoiceLineItemDto } from './dto/update-invoice-line-item.dto';
import { Invoice } from './entities/invoice.entity';

@Injectable()
export class InvoiceLineItemService {
  constructor(
    @InjectRepository(InvoiceLineItem)
    private readonly itemRepo: Repository<InvoiceLineItem>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  private computeLineTotal(unitPrice: number, quantity: number): number {
    // round to 2 decimals and return number
    return Number((unitPrice * quantity).toFixed(2));
  }

  private async ensureInvoiceBelongsToCompany(
    companyId: string,
    invoiceId: string,
  ) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      select: ['id', 'companyId'],
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    if (invoice.companyId !== companyId) {
      throw new BadRequestException(
        'Invoice does not belong to the current company',
      );
    }
    return invoice;
  }

  async create(
    companyId: string,
    invoiceId: string,
    dto: CreateInvoiceLineItemDto,
  ): Promise<InvoiceLineItem> {
    await this.ensureInvoiceBelongsToCompany(companyId, invoiceId);

    const unitPriceNum = Number(dto.unitPrice);
    const qtyNum = Number(dto.quantity);
    const item = this.itemRepo.create({
      invoiceId,
      companyId,
      description: dto.description,
      unitPrice: unitPriceNum,
      quantity: qtyNum,
      lineTotal: this.computeLineTotal(unitPriceNum, qtyNum),
    });
    return this.itemRepo.save(item);
  }

  async findAll(
    companyId: string,
    invoiceId: string,
  ): Promise<InvoiceLineItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.invoice', 'invoice')
      .where('item.invoiceId = :invoiceId', { invoiceId })
      .andWhere('invoice.companyId = :companyId', { companyId })
      .getMany();
  }

  async createMany(
    companyId: string,
    invoiceId: string,
    dtoArray: CreateInvoiceLineItemDto[],
  ): Promise<InvoiceLineItem[]> {
    await this.ensureInvoiceBelongsToCompany(companyId, invoiceId);

    const items = dtoArray.map((dto) => {
      const unitPriceNum = Number(dto.unitPrice);
      const qtyNum = Number(dto.quantity);
      return this.itemRepo.create({
        invoiceId,
        companyId,
        description: dto.description,
        unitPrice: unitPriceNum,
        quantity: qtyNum,
        lineTotal: this.computeLineTotal(unitPriceNum, qtyNum),
      });
    });

    return this.itemRepo.save(items);
  }

  async findOne(
    companyId: string,
    invoiceId: string,
    id: string,
  ): Promise<InvoiceLineItem> {
    const item = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.invoice', 'invoice')
      .where('item.id = :id', { id })
      .andWhere('item.invoiceId = :invoiceId', { invoiceId })
      .andWhere('invoice.companyId = :companyId', { companyId })
      .getOne();

    if (!item) throw new NotFoundException('Line item not found');
    return item;
  }

  async update(
    companyId: string,
    invoiceId: string,
    id: string,
    dto: UpdateInvoiceLineItemDto,
  ): Promise<InvoiceLineItem> {
    const item = await this.findOne(companyId, invoiceId, id);

    if (dto.description !== undefined) {
      item.description = dto.description;
    }

    if (dto.unitPrice !== undefined) {
      item.unitPrice = Number(dto.unitPrice);
    }

    if (dto.quantity !== undefined) {
      item.quantity = Number(dto.quantity);
    }

    // Recalculate lineTotal from canonical numeric values
    const price =
      dto.unitPrice !== undefined ? Number(dto.unitPrice) : item.unitPrice;
    const qty =
      dto.quantity !== undefined ? Number(dto.quantity) : item.quantity;

    item.lineTotal = this.computeLineTotal(price, qty);

    return this.itemRepo.save(item);
  }

  async remove(
    companyId: string,
    invoiceId: string,
    id: string,
  ): Promise<void> {
    const item = await this.findOne(companyId, invoiceId, id);
    const res = await this.itemRepo.delete(item.id);
    if (res.affected === 0) throw new NotFoundException('Line item not found');
  }
}
