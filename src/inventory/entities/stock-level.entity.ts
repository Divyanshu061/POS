// src/inventory/entities/stock-level.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(
    () => Product,
    (p: Product) => p.stockLevels, // ← explicitly type “p” as Product
  )
  product!: Product;
  @Column('int', { default: 0 })
  quantity!: number;

  @Column('uuid')
  warehouseId!: string;

  @Column('uuid')
  companyId!: string;

  @UpdateDateColumn()
  updatedAt!: Date;
}
