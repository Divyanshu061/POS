// File: create-report-definition.dto.ts
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateReportDefinitionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['sales', 'inventory', 'financial'])
  type!: 'sales' | 'inventory' | 'financial';

  @IsObject()
  parameters!: Record<string, any>;
}
