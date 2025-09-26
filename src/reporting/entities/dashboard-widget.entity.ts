//File: dashboard-widget.entity.ts**

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dashboard } from '../entities/dashboard.entity';
import { ReportDefinition } from '../entities/report-definition.entity';
import { Company } from '../../inventory/company/entities/company.entity';

@Entity('dashboard_widgets')
export class DashboardWidget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Dashboard, (dashboard) => dashboard.widgets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dashboard_id' })
  dashboard!: Dashboard;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: 'company_id' })
  company!: Company;

  @Column({ name: 'company_id', type: 'uuid', nullable: false })
  companyId!: string;

  @ManyToOne(() => ReportDefinition, (def) => def.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_definition_id' })
  definition!: ReportDefinition;

  @Column({ type: 'jsonb' })
  position!: { row: number; col: number; width: number; height: number };

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
