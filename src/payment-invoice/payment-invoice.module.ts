// src/payment-invoice/payment-invoice.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { Client } from './../crm/client/entities/client.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Payment, Client, Supplier])],
  controllers: [InvoiceController, PaymentController],
  providers: [InvoiceService, PaymentService],
})
export class PaymentInvoiceModule {}
