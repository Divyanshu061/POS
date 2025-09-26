// src/reporting/dto/run-report.dto.ts
import {
  IsOptional,
  IsObject,
  ValidateNested,
  IsEnum,
  IsISO8601,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  XLSX = 'xlsx',
}

export class ReportFilters {
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  // allow passing a company id via filters (controller / service expect this possibility)
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  // allow arbitrary ad-hoc keys if needed (not validated)
  [key: string]: unknown;
}

export class RunReportDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportFilters)
  filters?: ReportFilters;

  @IsEnum(ReportFormat)
  format!: ReportFormat;
}
