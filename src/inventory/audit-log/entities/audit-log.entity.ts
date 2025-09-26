// src/inventory/audit-log/entities/audit-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'audit_log' })
@Index(['entity', 'entityId', 'action', 'timestamp'])
@Index(['companyId']) // quick lookup by tenant
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  action!: 'CREATE' | 'UPDATE' | 'DELETE' | 'OTHER';

  @Column({ type: 'varchar', length: 100 })
  entity!: string;

  @Column({ type: 'varchar', length: 255 })
  entityId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  // NEW: tenant column
  @Column({ type: 'uuid', nullable: true })
  companyId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes?: { before?: Record<string, any>; after?: Record<string, any> };

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp!: Date;
}
