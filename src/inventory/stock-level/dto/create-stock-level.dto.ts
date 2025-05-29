// src/inventory/stock-level/dto/create-stock-level.dto.ts
import { IsUUID, IsInt, Min } from 'class-validator';

export class CreateStockLevelDto {
  @IsUUID() productId!: string;
  @IsUUID() warehouseId!: string;
  @IsInt() @Min(0) quantity!: number;
  @IsUUID() companyId!: string;
}
