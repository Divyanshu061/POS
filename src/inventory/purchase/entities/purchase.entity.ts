// src/inventory/purchase/entities/purchase.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { Product } from '../../product/entities/product.entity';

@Entity()
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Supplier, (s) => s.id, { nullable: false })
  @JoinColumn({ name: 'supplierId' })
  supplier!: Supplier;

  @Column('uuid')
  supplierId!: string;

  @ManyToOne(() => Product, (p) => p.id, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column('uuid')
  productId!: string;

  @Column('int')
  quantity!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitCost!: number;

  @Column('uuid')
  companyId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
