// src/payment-invoice/dto/create-invoice.dto.ts
import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceLineItemDto } from './create-invoice-line-item.dto';
import { InvoiceStatus } from '../enums/invoice-status.enum';

export class CreateInvoiceDto {
  @IsUUID()
  clientId!: string;

  @Type(() => Number)
  @IsNumber()
  totalAmount!: number;

  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  items?: CreateInvoiceLineItemDto[];
}
