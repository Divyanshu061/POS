//File: report-definition.entity.ts**

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
// Adjust import path based on your project structure:
import { Company } from '../../inventory/company/entities/company.entity';
import { ReportRun } from './report-run.entity';

@Entity('report_definitions')
export class ReportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['sales', 'purchases', 'inventory', 'financial'],
  })
  type!: 'sales' | 'purchases' | 'inventory' | 'financial';

  @Column({ type: 'jsonb' })
  parameters!: Record<string, any>;

  // Remove inverse relation if Company entity lacks reportDefinitions
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @OneToMany(() => ReportRun, (run) => run.definition)
  runs!: ReportRun[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
