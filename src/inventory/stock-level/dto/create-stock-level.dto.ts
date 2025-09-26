//src/inventory/stock-level/dto/create-stock-level.dto.ts
import { IsUUID, IsInt, Min, IsOptional } from 'class-validator';

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
   * Present to allow updates/read without unsafe-member-access warnings.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;
}
