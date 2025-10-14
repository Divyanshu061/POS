// src/inventory/stock-level/dto/create-stock-level.dto.ts
import { IsInt, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateStockLevelDto {
  @IsInt()
  productId!: number;

  @IsUUID()
  warehouseId!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  /**
   * Optional reorder level for the product at this warehouse.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}
