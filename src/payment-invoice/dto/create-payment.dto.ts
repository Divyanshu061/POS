// src/payment-invoice/dto/create-payment.dto.ts
import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsUUID()
  invoiceId!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  method?: string;
}
