// src/user/dto/create-user.dto.ts

import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Swagger decorator for API docs

export class CreateUserDto {
  @ApiProperty({ description: 'Name of the user' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Unique email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Password', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({
    description: 'ID of the company this user belongs to',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  companyId?: string;
}
