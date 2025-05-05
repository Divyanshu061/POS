// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  userId!: string;
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
