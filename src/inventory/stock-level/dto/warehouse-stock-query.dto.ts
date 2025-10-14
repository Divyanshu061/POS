// src/inventory/stock-level/dto/warehouse-stock-query.dto.ts
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class WarehouseStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
