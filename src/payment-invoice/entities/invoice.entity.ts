// src/payment-invoice/entities/invoice.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from '../../crm/client/entities/client.entity';
import { Payment } from './payment.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { Company } from '../../inventory/company/entities/company.entity';
import { User } from '../../entities/user.entity';
import { numericToNumber } from '../../common/transformers/numeric-transformer';
import { InvoiceStatus } from '../enums/invoice-status.enum';

@Index(['companyId', 'invoiceNumber'], { unique: true })
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  invoiceNumber!: string;

  @ManyToOne(() => Client, (client) => client.invoices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column('uuid')
  clientId!: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: numericToNumber,
  })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status!: InvoiceStatus;

  // 🔑 Company multi-tenancy
  @Column('uuid')
  companyId!: string;

  @ManyToOne(() => Company, (company) => company.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  // 🔑 User tracking
  @Column('uuid')
  createdBy!: string;

  @ManyToOne(() => User, (user) => user.invoices, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments!: Payment[];

  @OneToMany(() => InvoiceLineItem, (item) => item.invoice, { cascade: true })
  items!: InvoiceLineItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
