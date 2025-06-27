import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../inventory/product/entities/product.entity';
import { PurchaseOrder } from './purchase-order.entity';

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
