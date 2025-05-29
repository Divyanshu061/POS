import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
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

  @ManyToOne(() => Company, (company) => company.products, {
    onDelete: 'CASCADE',
  })
  company!: Company;

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  category?: Category;

  @OneToMany(() => StockLevel, (stockLevel) => stockLevel.product)
  stockLevels!: StockLevel[];

  @OneToMany(() => Transaction, (transaction) => transaction.product)
  transactions!: Transaction[];

  @ManyToOne(() => Supplier, (supplier) => supplier.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  supplier?: Supplier;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
