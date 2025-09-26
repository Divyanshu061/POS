// src/inventory/sales/entities/sale-item.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from '../../product/entities/product.entity';
import { decimalTransformer } from '../../../common/transformers/decimal.transformer';
import { Company } from '../../company/entities/company.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // --- Foreign Key: Sale ---
  @Column('uuid')
  saleId!: string;

  @ManyToOne(() => Sale, (sale) => sale.items, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'saleId' })
  sale!: Sale;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'company_id', type: 'uuid', nullable: false })
  companyId!: string;

  // --- Foreign Key: Product ---
  @Column('int')
  productId!: number;

  @ManyToOne(() => Product, {
    nullable: false,
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  // --- Item Details ---
  @Column('int')
  quantity!: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice!: number;
}
