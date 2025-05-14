// src/inventory/entities/transaction.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (prod: Product) => prod.transactions, {
    { nullable: false },
  )
  product!: Product;

  @ManyToOne(
    () => Warehouse,
    (wh: Warehouse) => wh.transactions,
    { nullable: false },
  )
  warehouse!: Warehouse;

  /**
   * If you still need the raw UUID reference separately,
   * keep this column. Otherwise you can remove it.
   */
  @Column('uuid')
  warehouseId!: string;

  @Column({
    type: 'enum',
    enum: ['IN', 'OUT', 'ADJUSTMENT'],
  })
  type!: TransactionType;

  @Column('int')
  quantity!: number;

  @Column({ nullable: true })
  reference?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
