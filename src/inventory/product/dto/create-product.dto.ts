// src/inventory/product/dto/create-product.dto.ts
import { IsString, IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() name!: string;
  @IsString() sku!: string;
  @IsString() @IsOptional() barcode?: string;
  @IsString() @IsOptional() description?: string;
  @IsUUID() @IsOptional() categoryId?: string;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsUUID() companyId!: string;
}
