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

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrder;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column()
  productId!: number;

  @Column('int')
  quantity!: number;

  @Column('int', { default: 0 })
  receivedQty!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice!: number;
}
