// src/inventory/sales/entities/sale.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';

@Entity()
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, (p) => p.id, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column('uuid')
  productId!: string;

  @Column('int')
  quantity!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice!: number;

  @Column('uuid')
  companyId!: string;

  @CreateDateColumn()
  soldAt!: Date;
}
