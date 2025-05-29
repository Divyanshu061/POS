// src/inventory/supplier/dto/create-supplier.dto.ts
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @IsString() name!: string;
  @IsString() @IsOptional() contactInfo?: string;
  @IsUUID() companyId!: string;
}
