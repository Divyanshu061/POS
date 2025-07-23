// src/payment-invoice/dto/create-invoice.dto.ts

import { IsUUID, IsEnum, IsNumber } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  clientId!: string;

  @IsNumber()
  totalAmount!: number;

  @IsEnum(['draft', 'issued', 'paid', 'cancelled'])
  status!: 'draft' | 'issued' | 'paid' | 'cancelled';
}
