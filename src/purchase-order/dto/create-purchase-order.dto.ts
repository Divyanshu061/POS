// src/purchase-order/dto/create-purchase-order.dto.ts
import {
  IsUUID,
  IsArray,
  IsDateString,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsInt()
  @Type(() => Number)
  @Min(1)
  productId!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

  /**
   * unitPrice is a decimal in DB; DTO accepts a number and service will
   * convert to string when saving to match the entity column type.
   */
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
