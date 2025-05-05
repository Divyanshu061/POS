// src/permissions/dto/create-permission.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  readonly name!: string; // Unique permission identifier, e.g. "inventory.create"

  @IsString()
  readonly description?: string; // Optional human-readable description
}
