// src/inventory/sales/dto/create-sale.dto.ts

import { IsUUID, IsInt, Min, IsNumber } from 'class-validator';

export class CreateSaleDto {
  @IsInt() productId!: number;
  @IsUUID() warehouseId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() unitPrice!: number;
  @IsUUID() companyId!: string;
}
