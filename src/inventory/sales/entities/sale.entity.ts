// src/inventory/sales/entities/sale.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';

@Entity()
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Warehouse, { nullable: false, eager: true })
  @JoinColumn({ name: 'warehouseId' })
  warehouse!: Warehouse;

  @Column('uuid')
  warehouseId!: string;

  @ManyToOne(() => Product, (p) => p.id, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column('int') // 🔄 changed from 'uuid'
  productId!: number;

  @Column('int')
  quantity!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice!: number;

  @Column('uuid')
  companyId!: string;

  @CreateDateColumn()
  soldAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
