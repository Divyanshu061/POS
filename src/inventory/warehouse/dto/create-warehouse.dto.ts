// src/inventory/warehouse/dto/create-warehouse.dto.ts
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateWarehouseDto {
  @IsString() name!: string;
  @IsString() @IsOptional() address?: string;
  @IsUUID() companyId!: string;
}
