// src/inventory/product/entities/product.entity.ts
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

import { Category } from '../../category/entities/category.entity';
import { StockLevel } from '../../stock-level/entities/stock-level.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { Company } from '../../company/entities/company.entity';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index()
  name!: string;

  // keep unique on column (remove redundant @Index({ unique: true }))
  @Column({ unique: true })
  sku!: string;

  @Column({ nullable: true })
  @Index()
  barcode?: string;

  @Column('text', { nullable: true })
  description?: string;

  // Use a transformer so TypeORM returns a number (not string) for decimal columns
  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value, // stored as-is
      from: (value: string) =>
        value === null || value === undefined ? 0 : parseFloat(value),
    },
  })
  unitPrice!: number;

  @Column({ nullable: true })
  productNumber?: string;

  @Column({ nullable: true })
  unit?: string; // e.g. 'pcs', 'kg', 'litre', etc.

  /**
   * category relation + foreign key
   * - relation is nullable
   * - column categoryId is uuid nullable and typed as string | null
   */
  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @Column('uuid', { nullable: true })
  categoryId?: string | null;

  /**
   * supplier relation + foreign key (nullable)
   */
  @ManyToOne(() => Supplier, (supplier) => supplier.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier | null;

  @Column('uuid', { nullable: true })
  supplierId?: string | null;

  /**
   * Explicit companyId column for multi-tenancy.
   * Keep the relation for convenience, but always filter using companyId in queries.
   */
  @Column('uuid', { name: 'companyId', nullable: false })
  companyId!: string;

  @ManyToOne(() => Company, (company) => company.products, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @OneToMany(() => StockLevel, (stockLevel) => stockLevel.product)
  stockLevels!: StockLevel[];

  @OneToMany(() => Transaction, (transaction) => transaction.product)
  transactions!: Transaction[];

  // ─────── Audit ───────
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
