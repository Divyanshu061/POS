// src/inventory/entities/product.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { StockLevel } from './stock-level.entity';
import { Transaction } from './transaction.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  sku!: string;

  @Column({ nullable: true })
  barcode?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  unitPrice!: number;

  @Column('uuid')
  companyId!: string;

  @ManyToOne(
    () => Category,
    (cat: Category) => cat.products, // ← explicitly type “cat” as Category
    { nullable: true },
  )
  category?: Category;

  @OneToMany(
    () => StockLevel,
    (sl: StockLevel) => sl.product, // ← explicitly type “sl” as StockLevel
  )
  stockLevels!: StockLevel[];

  @OneToMany(
    () => Transaction,
    (tx: Transaction) => tx.product, // ← explicitly type “tx” as Transaction
  )
  transactions!: Transaction[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
