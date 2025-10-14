// src/inventory/company/dto/create-company-user.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  IsArray,
  ArrayUnique,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name!: string;

  // password optional — you may want to force a temporary password or create via invite flow
  @ApiPropertyOptional({ example: 'P@ssw0rd123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  // optional roles (strings or enums depending on your Role model)
  @ApiPropertyOptional({ example: ['COMPANY_USER'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  roles?: string[];
}
