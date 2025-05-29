// src/inventory/audit-log/dto/create-audit-log.dto.ts
import { IsUUID, IsString, IsIn, IsOptional, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsIn(['CREATE', 'UPDATE', 'DELETE']) action!: 'CREATE' | 'UPDATE' | 'DELETE';
  @IsString() entity!: string;
  @IsUUID() entityId!: string;
  @IsUUID() userId!: string;
  @IsObject() @IsOptional() changes?: Record<string, any>;
}
