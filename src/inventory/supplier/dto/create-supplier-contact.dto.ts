// src/inventory/supplier/dto/create-supplier-contact.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
} from 'class-validator';

export class CreateSupplierContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
