// File: src/reporting/entities/report-run.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReportDefinition } from './report-definition.entity';
import { Company } from '../../inventory/company/entities/company.entity';

@Entity('report_runs')
export class ReportRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ReportDefinition, (def) => def.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'definition_id' })
  definition!: ReportDefinition;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status!: 'pending' | 'running' | 'completed' | 'failed';

  // ← NEW: store the filters used for this run
  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, any>;

  // ← NEW: store the requested format
  @Column({ length: 10 })
  format!: 'json' | 'csv' | 'xlsx';

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'company_id', type: 'uuid', nullable: false })
  companyId!: string;

  @Column({ type: 'jsonb', nullable: true })
  resultLocation?: { format: string; path: string };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
