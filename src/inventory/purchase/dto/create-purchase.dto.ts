// src/inventory/purchase/dto/create-purchase.dto.ts

import { IsUUID, IsInt, Min, IsNumber } from 'class-validator';

export class CreatePurchaseDto {
  @IsUUID() supplierId!: string;
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() unitCost!: number;
  @IsUUID() companyId!: string;
}
