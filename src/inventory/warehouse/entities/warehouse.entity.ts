import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StockLevel } from '../../stock-level/entities/stock-level.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

@Entity()
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  address?: string;

  @Column('uuid')
  companyId!: string;

  @OneToMany(() => StockLevel, (sl) => sl.warehouse)
  stockLevels!: StockLevel[];

  @OneToMany(() => Transaction, (tx) => tx.warehouse)
  transactions!: Transaction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
