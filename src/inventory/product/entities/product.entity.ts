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
  @Index() // For faster search
  name!: string;

  @Column({ unique: true })
  @Index({ unique: true }) // Ensures fast lookup & avoids duplicates
  sku!: string;

  @Column({ nullable: true })
  @Index() // Useful if you scan or lookup by barcode
  barcode?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  unitPrice!: number;

  // ----------------------------
  // Foreign Keys (explicitly added for TypeORM query flexibility)
  // ----------------------------

  @Column()
  companyId!: string;

  @Column({ nullable: true })
  categoryId?: number;

  @Column({ nullable: true })
  supplierId?: number;

  // ----------------------------
  // Relations
  // ----------------------------

  @ManyToOne(() => Company, (company) => company.products, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'companyId' }) // maps to companyId column
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

  // ----------------------------
  // Audit Fields
  // ----------------------------

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
