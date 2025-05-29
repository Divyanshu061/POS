// src/inventory/product/dto/create-product.dto.ts

import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsUUID()
  companyId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  // Keep only this one block for supplierId:
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supplierId?: number;
}
