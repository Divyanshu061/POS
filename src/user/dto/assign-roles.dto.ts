// src/user/dto/assign-roles.dto.ts

import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  readonly roleIds!: string[]; // array of Role UUIDs
}
