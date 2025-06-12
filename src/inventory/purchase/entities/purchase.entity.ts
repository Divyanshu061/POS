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

@Entity({ name: 'purchase' })
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Many purchases belong to one supplier.
   * No inverse-side provided to avoid mapping issues.
   */
  @ManyToOne(() => Supplier, { nullable: false })
  @JoinColumn({ name: 'supplierId' })
  supplier!: Supplier;

  @Column('uuid')
  supplierId!: string;

  /**
   * Many purchases belong to one product.
   * No inverse-side provided to avoid mapping issues.
   */
  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  @Column('int')
  productId!: number;

  /**
   * Number of units purchased. Must be >= 1.
   */
  @Column('int')
  quantity!: number;

  /**
   * Cost per unit at the time of purchase.
   */
  @Column('decimal', { precision: 10, scale: 2 })
  unitCost!: number;

  /**
   * Company tenancy identifier (for multi-tenant support).
   */
  @Column('uuid')
  companyId!: string;

  /**
   * Automatically set when the purchase record is created.
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
