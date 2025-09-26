// src/payment-invoice/entities/invoice-line-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { numericToNumber } from '../../common/transformers/numeric-transformer';
import { Company } from '../../inventory/company/entities/company.entity';

@Entity('invoice_line_items')
@Index(['companyId', 'invoiceId'])
@Check(`"quantity" >= 0`)
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  /**
   * Stored as DECIMAL in DB for precision; exposed as `number` in app via transformer.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: numericToNumber,
  })
  unitPrice!: number;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  /**
   * Computed line total (unitPrice * quantity), stored as DECIMAL in DB,
   * exposed as `number` in app via transformer.
   */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: numericToNumber,
  })
  lineTotal!: number;

  // foreign key to invoice
  @Column('uuid')
  invoiceId!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;

  @Column('uuid')
  companyId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company!: Company;
}
