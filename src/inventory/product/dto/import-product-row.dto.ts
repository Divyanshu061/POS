import { Type, Transform, TransformFnParams } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ImportProductRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku!: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as unknown as number),
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  @MaxLength(100)
  productNumber?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  categoryName?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) =>
    value === '' ? undefined : (value as string),
  )
  @IsString()
  supplierName?: string;
}

export type ImportRowResult =
  | { ok: true; sku: string; id?: number }
  | { ok: false; sku?: string; errors: string[] };

export class ImportSummaryDto {
  total!: number;
  valid!: number;
  invalid!: number;
  createdIds!: number[];
  results!: ImportRowResult[];
}
