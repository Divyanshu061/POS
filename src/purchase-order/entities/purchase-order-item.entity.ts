// src/purchase-order/entities/purchase-order-item.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../inventory/product/entities/product.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { Company } from '../../inventory/company/entities/company.entity';

// Optional: index for faster tenant + product lookups
@Index(['companyId', 'productId'])
@Entity('purchase_order_item')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** FK → purchase_order.id */
  @Column({ name: 'purchase_order_id', type: 'uuid' })
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

  /** tenant link (redundant but helpful for queries/joins) */
  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  /** FK → product.id */
  @Column({ name: 'product_id', type: 'int' })
  productId!: number;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  /** Quantity ordered */
  @Column('int')
  quantity!: number;

  /** Quantity received so far */
  @Column('int', { default: 0 })
  receivedQty!: number;

  /** Price per unit */
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice!: string;
}
