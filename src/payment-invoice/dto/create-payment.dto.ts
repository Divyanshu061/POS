// src/payment-invoice/dto/create-payment.dto.ts
import {
  IsUUID,
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  invoiceId!: string;

  @IsNumber()
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  method?: string;
}
