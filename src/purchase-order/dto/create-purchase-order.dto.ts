import {
  IsUUID,
  IsString,
  IsArray,
  IsDateString,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsInt()
  @Type(() => Number)
  productId!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  quantity!: number;

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

  @IsString()
  orderNumber!: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
