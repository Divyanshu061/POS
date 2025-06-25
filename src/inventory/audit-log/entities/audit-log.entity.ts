// src/inventory/audit-log/entities/audit-log.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Immutable log of create/update/delete operations across inventory entities
 */
@Entity({ name: 'audit_log' })
@Index(['entity', 'entityId', 'action', 'timestamp'])
export class AuditLog {
  /**
   * Unique identifier for the audit log entry
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Type of operation performed
   */
  @Column({ type: 'varchar', length: 10 })
  action!: 'CREATE' | 'UPDATE' | 'DELETE';

  /**
   * Name of the entity/table affected (e.g. "Product", "Transaction")
   */
  @Column({ type: 'varchar', length: 100 })
  entity!: string;

  /**
   * Primary key of the affected record
   */
  @Column({ type: 'varchar', length: 36 })
  entityId!: string;

  /**
   * Identifier of the user who performed the action (if available)
   */
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  /**
   * JSON payload capturing before and after states or changed fields
   * e.g. { before: { ... }, after: { ... } }
   */
  @Column({ type: 'jsonb', nullable: true })
  changes?: { before?: Record<string, any>; after?: Record<string, any> };

  /**
   * Timestamp when the audit entry was created
   */
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp!: Date;
}
