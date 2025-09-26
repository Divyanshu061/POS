//src/payment-invoice/dto/create-invoice-line-item.dto.ts
import { IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceLineItemDto {
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;
}
