// File: src/payment-invoice/dto/create-invoice-line-item.dto.ts
import { IsString, IsNumber } from 'class-validator';

export class CreateInvoiceLineItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  quantity!: number;
}
