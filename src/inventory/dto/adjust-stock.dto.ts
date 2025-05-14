import {
  IsUUID,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum StockAction {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class AdjustStockDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsEnum(StockAction)
  type!: StockAction;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsUUID()
  companyId!: string;
}
