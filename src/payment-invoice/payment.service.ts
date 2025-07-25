// src/payment-invoice/payment.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Payment } from './entities/payment.entity';
import { Invoice } from './entities/invoice.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    if (dto.amount <= 0) {
      throw new BadRequestException(`Payment amount must be greater than 0`);
    }

    const payment = this.paymentRepo.create({
      invoice: { id: dto.invoiceId },
      amount: dto.amount,
      paidAt: new Date(dto.paidAt),
      method: dto.method,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // Recalculate total paid
    const payments = await this.paymentRepo.find({
      where: { invoice: { id: dto.invoiceId } },
    });

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const invoiceTotal = Number(invoice.totalAmount ?? 0);

    // Update invoice status
    if (invoiceTotal > 0) {
      if (totalPaid >= invoiceTotal) {
        invoice.status = 'paid';
      } else {
        invoice.status = 'issued';
      }
      await this.invoiceRepo.save(invoice);
    }

    return savedPayment;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    const payments = await this.paymentRepo.find({
      where: { invoice: { id: invoiceId } },
      order: { paidAt: 'DESC' },
    });

    if (payments.length === 0) {
      throw new NotFoundException(`No payments found for invoice ${invoiceId}`);
    }

    return payments;
  }
}
