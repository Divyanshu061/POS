// src/inventory/stock-level/dto/create-stock-level.dto.ts
import { IsUUID, IsInt, Min } from 'class-validator';

export class CreateStockLevelDto {
  @IsInt() productId!: number;
  @IsUUID() warehouseId!: string;
  @IsInt() @Min(0) quantity!: number;
  @IsUUID() companyId!: string;
}
