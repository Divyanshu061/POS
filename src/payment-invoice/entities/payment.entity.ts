import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  invoice!: Invoice;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  paidAt!: Date;

  @Column({ type: 'varchar', length: 30, nullable: true })
  method!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
