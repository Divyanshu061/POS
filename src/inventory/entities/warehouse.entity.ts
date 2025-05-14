// src/inventory/entities/warehouse.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StockLevel } from './stock-level.entity';
import { Transaction } from './transaction.entity';

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

  // link to stock‐levels
  @OneToMany(() => StockLevel, (sl: StockLevel) => sl.warehouse)
  stockLevels!: StockLevel[];

  // link to transactions
  @OneToMany(() => Transaction, (tx: Transaction) => tx.warehouse)
  transactions!: Transaction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
