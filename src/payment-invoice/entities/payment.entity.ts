// src/payment-invoice/entities/payment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { numericToNumber } from '../../common/transformers/numeric-transformer';
import { User } from '../../entities/user.entity';
import { Company } from '../../inventory/company/entities/company.entity';

@Entity('payments')
@Index(['companyId', 'invoiceId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;

  @Column('uuid')
  invoiceId!: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericToNumber,
  })
  amount!: number;

  // use timestamptz if you need timezone-aware time; keep 'date' if you want date-only
  @Column({ type: 'date' })
  paidAt!: Date;

  // allow null in the property type so assignment of null is legal
  @Column({ type: 'varchar', length: 30, nullable: true })
  method?: string | null;

  @Column('uuid')
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  // optional auditing who recorded the payment
  @Column('uuid', { nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  createdByUser?: User | null;

  @CreateDateColumn()
  createdAt!: Date;
}
