// src/payment-invoice/payment.controller.ts

import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  @Get('invoice/:invoiceId')
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.paymentService.findByInvoice(invoiceId);
  }
}
