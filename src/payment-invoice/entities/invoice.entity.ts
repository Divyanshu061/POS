// File: src/payment-invoice/entities/invoice.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../crm/client/entities/client.entity';
import { Payment } from './payment.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  invoiceNumber!: string;

  @ManyToOne(() => Client, (client) => client.invoices, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column('uuid')
  clientId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: ['draft', 'issued', 'paid', 'cancelled'],
    default: 'draft',
  })
  status!: 'draft' | 'issued' | 'paid' | 'cancelled';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments!: Payment[];

  // New one-to-many relation for line items
  // @OneToMany(() => InvoiceLineItem, (item) => item.invoice, { cascade: true })
  // items!: InvoiceLineItem[];

  @OneToMany(
    () => InvoiceLineItem,
    (lineItem: InvoiceLineItem) => lineItem.invoice,
    { cascade: true },
  )
  items!: InvoiceLineItem[];
}
