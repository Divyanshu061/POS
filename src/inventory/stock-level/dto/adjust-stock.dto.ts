// src/inventory/stock-level/dto/adjust-stock.dto.ts

import {
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransactionType } from '../../transaction/entities/transaction.entity';

export class AdjustStockDto {
  /**
   * ID of the product to be adjusted
   */
  @IsUUID()
  productId!: string;

  /**
   * ID of the warehouse where the stock is stored
   */
  @IsUUID()
  warehouseId!: string;

  /**
   * Type of stock adjustment: IN or OUT
   */
  @IsEnum(TransactionType, { message: 'Type must be either IN or OUT' })
  type!: TransactionType;

  /**
   * Quantity to adjust (must be at least 1)
   */
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;

  /**
   * Optional reference for the stock adjustment (e.g., invoice number)
   */
  @IsOptional()
  @IsString({ message: 'Reference must be a string' })
  reference?: string;

  /**
   * ID of the company owning the stock
   */
  @IsUUID()
  companyId!: string;
}
