//File: report-run.entity.ts**

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

  @Column({ type: 'jsonb', nullable: true })
  resultLocation?: { format: string; path: string };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
