import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  DataSource,
  QueryRunner,
} from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Data stored on QueryRunner for audit context
 */
interface RunnerData {
  userId?: string;
  before?: Record<string, unknown>;
}

@EventSubscriber()
@Injectable()
export class AuditLogSubscriber implements EntitySubscriberInterface<unknown> {
  private readonly logger = new Logger(AuditLogSubscriber.name);

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  /**
   * Subscribe to all entities except AuditLog itself
   */
  listenTo(): new (...args: any[]) => unknown {
    return Object;
  }

  /**
   * Safely extract primary key as string
   */
  private extractPrimaryKey(
    event:
      | InsertEvent<Record<string, unknown>>
      | UpdateEvent<Record<string, unknown>>,
  ): string {
    const entity = event.entity;
    if (!entity) return '';

    const primaryColumn = event.metadata.primaryColumns[0];
    const rawValue = primaryColumn.getEntityValue(entity) as unknown;

    if (typeof rawValue === 'string') return rawValue;
    if (typeof rawValue === 'number') return rawValue.toString();
    if (
      rawValue &&
      typeof (rawValue as { toString(): string }).toString === 'function'
    ) {
      return (rawValue as { toString(): string }).toString();
    }
    return '';
  }

  async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    if (event.entity instanceof AuditLog) return;
    const entityData = event.entity as Record<string, unknown>;
    await this.handleAudit(
      event.queryRunner,
      'CREATE',
      event as InsertEvent<Record<string, unknown>>,
      entityData,
    );
  }

  beforeUpdate(event: UpdateEvent<unknown>): void {
    if (event.entity instanceof AuditLog) return;
    const prevEntity = event.databaseEntity as
      | Record<string, unknown>
      | undefined;
    const prevData = prevEntity ?? {};
    const existing = (event.queryRunner.data as RunnerData) ?? {};
    const data: RunnerData = { ...existing, before: { ...prevData } };
    event.queryRunner.data = data;
  }

  async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    if (event.entity instanceof AuditLog || !event.entity) return;
    const entityData = event.entity as Record<string, unknown>;
    await this.handleAudit(
      event.queryRunner,
      'UPDATE',
      event as UpdateEvent<Record<string, unknown>>,
      entityData,
    );
  }

  async afterRemove(event: RemoveEvent<unknown>): Promise<void> {
    if (event.entity instanceof AuditLog) return;
    const beforeEntity = event.databaseEntity as
      | Record<string, unknown>
      | undefined;
    const before = beforeEntity ?? {};
    await this.handleAudit(
      event.queryRunner,
      'DELETE',
      event as RemoveEvent<Record<string, unknown>>,
      before,
    );
  }

  /**
   * Central audit writer with error isolation
   */
  private async handleAudit(
    qr: QueryRunner,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    event:
      | InsertEvent<Record<string, unknown>>
      | UpdateEvent<Record<string, unknown>>
      | RemoveEvent<Record<string, unknown>>,
    entityData: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      const table = event.metadata.tableName;
      const entityId =
        action === 'DELETE'
          ? String((event as RemoveEvent<Record<string, unknown>>).entityId)
          : this.extractPrimaryKey(
              event as
                | InsertEvent<Record<string, unknown>>
                | UpdateEvent<Record<string, unknown>>,
            );

      const runnerData = (qr.data as RunnerData) ?? {};
      const before = runnerData.before;
      const after =
        action !== 'DELETE' && entityData ? { ...entityData } : undefined;

      qr.data = runnerData;
      const userId = runnerData.userId;

      const repo = qr.manager.getRepository(AuditLog);
      const audit = repo.create({
        action,
        entity: table,
        entityId,
        userId,
        changes: { before, after },
      });

      await repo.save(audit);
    } catch (err) {
      this.logger.error('Failed to write audit log', err as Error);
    }
  }
}
