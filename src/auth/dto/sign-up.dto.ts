// src/auth/dto/sign-up.dto.ts

import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /**
   * Optional: assign roles by their database IDs.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];

  /**
   * Optional: assign roles by their human-readable names.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleNames?: string[];
}
