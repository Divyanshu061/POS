// src/inventory/category/dto/create-category.dto.ts
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsString() name!: string;
  @IsUUID() @IsOptional() parentCategoryId?: string;
  @IsUUID() companyId!: string;
}
