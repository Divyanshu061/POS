// File: create-widget.dto.ts

import { IsString, IsObject, IsOptional } from 'class-validator';

export class CreateWidgetDto {
  @IsString()
  reportDefinitionId!: string;

  @IsObject()
  position!: { row: number; col: number; width: number; height: number };

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
