// src/inventory/audit-log/entities/audit-log.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  action!: 'CREATE' | 'UPDATE' | 'DELETE';

  @Column()
  entity!: string; // e.g. "Product", "Sale"

  @Column('varchar')
  entityId!: string;

  @Column('uuid', { nullable: true })
  userId!: string; // who performed the action

  @Column('json', { nullable: true })
  changes?: Record<string, any>; // before/after snapshot

  @CreateDateColumn()
  timestamp!: Date;
}
