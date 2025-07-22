//file : src/Reporting/dto/create-widget.dto.ts

import { IsUUID, IsObject, IsOptional } from 'class-validator';
export class CreateWidgetDto {
  @IsUUID()
  dashboardId!: string;

  @IsUUID()
  reportDefinitionId!: string;

  @IsObject()
  position!: { row: number; col: number; width: number; height: number };

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
