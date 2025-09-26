// src/payment-invoice/payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CurrentCompany } from '../auth/decorators/current-company.decorator';
import { UserId } from '../auth/decorators/user-id.decorator';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body() dto: CreatePaymentDto,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.paymentService.create(companyId, dto, userId);
  }

  @Get('invoice/:invoiceId')
  findByInvoice(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.paymentService.findByInvoice(companyId, invoiceId);
  }
}
