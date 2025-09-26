// src/payment-invoice/invoice.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CurrentCompany } from '../auth/decorators/current-company.decorator';
import { UserId } from '../auth/decorators/user-id.decorator';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  async create(
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body() dto: CreateInvoiceDto,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.invoiceService.create(companyId, dto, userId);
  }

  @Get()
  findAll(@CurrentCompany() companyId: string) {
    return this.invoiceService.findAll(companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.invoiceService.findOne(companyId, id);
  }
}
