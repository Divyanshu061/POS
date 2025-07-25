// src/payment-invoice/payment-invoice.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { InvoiceLineItemController } from './invoice-line-item.controller';
import { InvoiceLineItemService } from './invoice-line-item.service';
import { Client } from '../crm/client/entities/client.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      Payment,
      InvoiceLineItem,
      Client,
      Supplier,
    ]),
  ],
  controllers: [
    InvoiceController,
    PaymentController,
    InvoiceLineItemController,
  ],
  providers: [InvoiceService, PaymentService, InvoiceLineItemService],
})
export class PaymentInvoiceModule {}
