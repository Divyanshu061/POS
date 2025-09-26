// src/payment-invoice/invoice-line-item.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { InvoiceLineItemService } from './invoice-line-item.service';
import { CreateInvoiceLineItemDto } from './dto/create-invoice-line-item.dto';
import { UpdateInvoiceLineItemDto } from './dto/update-invoice-line-item.dto';
import { CurrentCompany } from '../auth/decorators/current-company.decorator';

@Controller('invoices/:invoiceId/items')
export class InvoiceLineItemController {
  constructor(private readonly service: InvoiceLineItemService) {}

  @Post()
  create(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateInvoiceLineItemDto,
  ) {
    return this.service.create(companyId, invoiceId, dto);
  }

  @Get()
  findAll(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.findAll(companyId, invoiceId);
  }

  @Get(':id')
  findOne(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, invoiceId, id);
  }

  @Post('bulk')
  createMany(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dtoArray: CreateInvoiceLineItemDto[],
  ) {
    return this.service.createMany(companyId, invoiceId, dtoArray);
  }

  @Patch(':id')
  update(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceLineItemDto,
  ) {
    return this.service.update(companyId, invoiceId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentCompany() companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, invoiceId, id);
  }
}
