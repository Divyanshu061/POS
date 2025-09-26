// src/inventory/sales/dto/create-sale.dto.ts

import {
  IsUUID,
  IsInt,
  Min,
  IsNumber,
  IsEnum,
  IsISO8601,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  BANK = 'BANK',
  OTHER = 'OTHER',
}

class SaleItemDto {
  @IsInt()
  productId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  unitPrice!: number;
}

export class CreateSaleDto {
  @IsUUID()
  clientId!: string;

  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsNumber()
  amountPaid!: number;

  @IsOptional()
  notes?: string;

  @IsISO8601()
  saleDate!: string;

  @IsUUID()
  warehouseId!: string;
}
