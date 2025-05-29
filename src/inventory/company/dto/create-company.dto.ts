// src/inventory/company/dto/create-company.dto.ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
