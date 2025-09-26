// src/inventory/audit-log/audit-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto';

/**
 * Allowed audit actions
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER';

export interface AuthenticatedUser {
  userId: string;
  companyId?: string | null;
  email?: string;
  roles?: string[];
}

export interface AuditLogEntry<T = unknown> {
  entity: string;
  entityId?: string | null;
  action?: AuditAction;
  user?: AuthenticatedUser | null;
  userId?: string | null;
  companyId?: string | null;
  before?: T | null;
  after?: T | null;
  changes?: unknown;
  meta?: Record<string, unknown>;
}

/**
 * Type guard to detect the legacy DTO-like shape.
 */
function isCreateAuditLogDto(x: unknown): x is CreateAuditLogDto {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.entity !== 'string') return false;
  if (
    Object.prototype.hasOwnProperty.call(obj, 'changes') ||
    Object.prototype.hasOwnProperty.call(obj, 'userId') ||
    Object.prototype.hasOwnProperty.call(obj, 'action') ||
    Object.prototype.hasOwnProperty.call(obj, 'entityId')
  ) {
    return true;
  }
  return false;
}

function getOptionalString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const val = rec[key];
  return typeof val === 'string' ? val : undefined;
}

function getOptionalRecord(
  obj: unknown,
  key: string,
): Record<string, unknown> | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const rec = obj as Record<string, unknown>;
  const val = rec[key];
  if (typeof val === 'object' && val !== null)
    return val as Record<string, unknown>;
  return undefined;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Accept either CreateAuditLogDto (legacy) or AuditLogEntry<T> (typed).
   * Normalizes inputs into DeepPartial<AuditLog> before calling TypeORM.
   */
  async log(entry: CreateAuditLogDto | AuditLogEntry<any>): Promise<AuditLog> {
    // LEGACY DTO path
    if (isCreateAuditLogDto(entry)) {
      const dto = entry;

      const safeDto: DeepPartial<AuditLog> = {
        // no unnecessary assertion here
        action: dto.action ?? 'OTHER',
        entity: dto.entity,
        entityId: getOptionalString(dto, 'entityId'),
        userId: typeof dto.userId === 'string' ? dto.userId : undefined,
        companyId: getOptionalString(dto, 'companyId'),
        changes: getOptionalRecord(dto, 'changes'),
      };

      const created = this.repo.create(safeDto);
      return await this.repo.save(created);
    }

    // TYPED AuditLogEntry path
    const e = entry;

    const userId = e.user?.userId ?? e.userId ?? undefined;
    const companyId = e.user?.companyId ?? e.companyId ?? undefined;

    const changes: Record<string, unknown> | undefined = (() => {
      if (e.changes !== undefined) {
        if (typeof e.changes === 'object' && e.changes !== null) {
          return e.changes as Record<string, unknown>;
        }
        return { value: e.changes } as Record<string, unknown>;
      }

      if (e.before !== undefined || e.after !== undefined) {
        // remove 'as unknown' — keep plain values
        return {
          before: e.before ?? null,
          after: e.after ?? null,
        };
      }

      return undefined;
    })();

    const safeEntry: DeepPartial<AuditLog> = {
      // remove unnecessary assertion to AuditAction
      action: e.action ?? 'OTHER',
      entity: e.entity,
      entityId: e.entityId ?? undefined,
      userId,
      companyId,
      changes,
    };

    const created = this.repo.create(safeEntry);
    return await this.repo.save(created);
  }

  findAll(): Promise<AuditLog[]> {
    return this.repo.find({ order: { timestamp: 'DESC' } });
  }

  findByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { entity, entityId },
      order: { timestamp: 'DESC' },
    });
  }
}
