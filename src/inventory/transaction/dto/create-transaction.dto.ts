// src/inventory/transaction/dto/create-transaction.dto.ts
import {
  IsUUID,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class CreateTransactionDto {
  @IsInt() productId!: number;
  @IsUUID() warehouseId!: string;
  @IsEnum(TransactionType) type!: TransactionType;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @IsOptional() reference?: string;
  @IsUUID() companyId!: string;
}
