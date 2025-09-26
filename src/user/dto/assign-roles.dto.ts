// src/user/dto/assign-roles.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  ArrayUnique,
} from 'class-validator';

export class AssignRolesDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  readonly roleIds?: string[]; // array of Role UUIDs

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  readonly roleNames?: string[]; // array of role names (e.g. ['admin','store_manager'])
}
