// src/payment-invoice/invoice.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    // Only include known properties; use clientId rather than a nested client object
    const invoice = this.invoiceRepo.create({
      invoiceNumber: `INV-${Date.now()}`,
      clientId: dto.clientId,
      totalAmount: dto.totalAmount,
      status: dto.status,
    });
    return this.invoiceRepo.save(invoice);
  }

  async findAll(): Promise<Invoice[]> {
    // Rename relation from 'customer' to 'client'
    return this.invoiceRepo.find({ relations: ['client', 'payments'] });
  }

  async findOne(id: string): Promise<Invoice> {
    // Use the new findOne signature with options object
    const inv = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['client', 'payments'],
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }
}
