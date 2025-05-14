// src/user/dto/create-user.dto.ts

import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsMongoId,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Unique email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password (min length 6)',
    minLength: 6,
    example: 'strongPassword123',
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({
    description: 'ID of the company this user belongs to (Mongo ObjectId)',
    example: '60f7c0f8d5e4f912c0abcd12',
  })
  @IsOptional()
  @IsMongoId()
  companyId?: string;

  //---------------------------------------------
  // New optional fields for role assignment:
  //---------------------------------------------

  @ApiPropertyOptional({
    description: 'Assign roles at signup by their UUIDs',
    type: [String],
    example: ['11111111-2222-3333-4444-555555555555'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    description: 'Assign roles at signup by their names',
    type: [String],
    example: ['admin', 'sales_rep'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleNames?: string[];
}
