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

  @Column({ unique: true })
  @Index({ unique: true })
  sku!: string;

  @Column({ nullable: true })
  @Index()
  barcode?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  unitPrice!: number;

  /**
   * Optional additional product info
   */
  @Column({ nullable: true })
  productNumber?: string;

  @Column({ nullable: true })
  unit?: string; // e.g. 'pcs', 'kg', 'litre', etc.

  @Column('int', { default: 0 })
  quantity!: number;

  // ─────── Foreign Key Fields ───────
  @Column('uuid')
  companyId!: string;

  @Column('uuid', { nullable: true })
  categoryId?: string;

  @Column('uuid', { nullable: true })
  supplierId?: string;

  // ─────── Relations ───────
  @ManyToOne(() => Company, (company) => company.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @ManyToOne(() => Supplier, (supplier) => supplier.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

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
