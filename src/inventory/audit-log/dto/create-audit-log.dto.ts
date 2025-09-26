// src/inventory/audit-log/dto/create-audit-log.dto.ts
import { IsUUID, IsString, IsIn, IsOptional, IsObject } from 'class-validator';

/**
 * Audit log DTO — relaxed validators so subscribers / programmatic writers
 * don't fail validation when entityId is non-UUID or missing userId.
 */
export class CreateAuditLogDto {
  @IsIn(['CREATE', 'UPDATE', 'DELETE', 'OTHER'])
  action!: 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER';

  @IsString()
  entity!: string;

  // entityId may be a uuid, number-as-string, or composite string -> use IsString
  @IsString()
  @IsOptional()
  entityId?: string | null;

  // user may not always be present (system)
  @IsUUID()
  @IsOptional()
  userId?: string | null;

  // companyId (multi-tenant) — optional
  @IsUUID()
  @IsOptional()
  companyId?: string | null;

  // JSON blob for before/after or diffs
  @IsObject()
  @IsOptional()
  changes?: Record<string, any> | null;

  // optional arbitrary metadata
  @IsObject()
  @IsOptional()
  meta?: Record<string, any> | null;
}
