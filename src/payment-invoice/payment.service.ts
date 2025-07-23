// src/payment-invoice/payment.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepo.create({
      // use nested object to link relation; cast suppressed
      invoice: { id: dto.invoiceId },
      amount: dto.amount,
      paidAt: new Date(dto.paidAt),
      method: dto.method,
    });
    return this.paymentRepo.save(payment);
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    // Query via relation to avoid unknown column error
    return this.paymentRepo.find({ where: { invoice: { id: invoiceId } } });
  }
}
