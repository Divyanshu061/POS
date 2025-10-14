// src/inventory/supplier/dto/create-supplier.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSupplierContactDto } from './create-supplier-contact.dto';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierContactDto)
  contacts?: CreateSupplierContactDto[];
}
