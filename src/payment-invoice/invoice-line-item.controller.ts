// File: src/payment-invoice/invoice-line-item.controller.ts
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

@Controller('invoices/:invoiceId/items')
export class InvoiceLineItemController {
  constructor(private readonly service: InvoiceLineItemService) {}

  @Post()
  create(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateInvoiceLineItemDto,
  ) {
    return this.service.create(invoiceId, dto);
  }

  @Get()
  findAll(@Param('invoiceId') invoiceId: string) {
    return this.service.findAll(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('bulk')
  createMany(
    @Param('invoiceId') invoiceId: string,
    @Body() dtoArray: CreateInvoiceLineItemDto[],
  ) {
    return this.service.createMany(invoiceId, dtoArray);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceLineItemDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
