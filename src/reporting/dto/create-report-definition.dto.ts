// File: src/reporting/dto/create-report-definition.dto.ts

import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateReportDefinitionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // ← only the 4 allowed type‑strings go here,
  //    and they must match the TS union exactly:
  @IsEnum(['sales', 'purchases', 'inventory', 'financial'] as const)
  type!: 'sales' | 'purchases' | 'inventory' | 'financial';

  @IsObject()
  parameters!: Record<string, any>;

  @IsString()
  companyId!: string;
}
