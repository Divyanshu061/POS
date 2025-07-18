// File: src/reporting/dto/run-report.dto.ts

import {
  IsOptional,
  IsObject,
  ValidateNested,
  IsEnum,
  IsISO8601,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilters {
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class RunReportDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportFilters)
  filters?: ReportFilters;

  @IsEnum(['json', 'csv', 'xlsx'])
  format!: 'json' | 'csv' | 'xlsx';
}
