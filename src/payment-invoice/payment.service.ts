// src/payment-invoice/payment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Payment } from './entities/payment.entity';
import { Invoice } from './entities/invoice.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceStatus } from './enums/invoice-status.enum';
// or from enum file path

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create payment for an invoice, ensuring invoice belongs to the company.
   * Runs in a transaction to persist payment and update invoice status atomically.
   *
   * Note: userId is accepted for auditing/logging and persisted to Payment.createdBy if present.
   */
  async create(
    companyId: string,
    dto: CreatePaymentDto,
    userId: string,
  ): Promise<Payment> {
    this.logger.debug(
      `Creating payment for invoice=${dto.invoiceId} by user=${userId}`,
    );

    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoiceId },
      select: ['id', 'companyId', 'totalAmount', 'status'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    if (invoice.companyId !== companyId) {
      throw new BadRequestException(
        'Invoice does not belong to the current company',
      );
    }

    if (Number(dto.amount) <= 0) {
      throw new BadRequestException(`Payment amount must be greater than 0`);
    }

    // quick overpayment prevention (also re-check inside transaction for full safety)
    const paidResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'sum')
      .where('p.invoiceId = :invoiceId AND p.companyId = :companyId', {
        invoiceId: dto.invoiceId,
        companyId,
      })
      .getRawOne<{ sum: string }>();

    const totalPaidSoFar = Number(paidResult?.sum ?? 0);
    const paymentAmount = Number(dto.amount || 0);
    const invoiceTotal = Number(invoice.totalAmount ?? 0);

    if (totalPaidSoFar + paymentAmount > invoiceTotal) {
      throw new BadRequestException('Payment exceeds invoice total');
    }

    return await this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const invoiceRepo = manager.getRepository(Invoice);

      // Create using invoiceId (avoid relation object to keep typings clean)
      const payment = paymentRepo.create({
        invoiceId: dto.invoiceId,
        companyId,
        amount: Number(dto.amount),
        paidAt: new Date(dto.paidAt),
        method: dto.method ?? null,
        createdBy: userId ?? null,
      });

      const savedPayment = await paymentRepo.save(payment);

      // Recalculate total paid for the invoice within the transaction using aggregate
      const paidRaw = await paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount),0)', 'sum')
        .where('p.invoiceId = :invoiceId AND p.companyId = :companyId', {
          invoiceId: dto.invoiceId,
          companyId,
        })
        .getRawOne<{ sum: string }>();

      const totalPaid = Number(paidRaw?.sum ?? 0);

      // Update invoice status
      if (invoiceTotal > 0) {
        const newStatus: InvoiceStatus =
          totalPaid >= invoiceTotal ? InvoiceStatus.PAID : InvoiceStatus.ISSUED;

        await invoiceRepo.update({ id: invoice.id }, { status: newStatus });
      }

      return savedPayment;
    });
  }

  async findByInvoice(
    companyId: string,
    invoiceId: string,
  ): Promise<Payment[]> {
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.invoiceId = :invoiceId AND p.companyId = :companyId', {
        invoiceId,
        companyId,
      })
      .orderBy('p.paidAt', 'DESC')
      .getMany();

    if (payments.length === 0) {
      throw new NotFoundException(`No payments found for invoice ${invoiceId}`);
    }

    return payments;
  }
}
