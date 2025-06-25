//src/purchase-orer/entities/purchase-order.entity
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Supplier } from '../../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../../inventory/warehouse/entities/warehouse.entity';
import { User } from '../../entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';

@Entity('purchase_order')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  orderNumber!: string;

  @ManyToOne(() => Supplier, { eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @ManyToOne(() => Warehouse, { eager: true })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy!: User;

  @Column({
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.PENDING,
    nullable: false,
  })
  status!: PurchaseOrderStatus;

  @Column({ type: 'date' })
  orderDate!: Date;

  @Column({ type: 'date', nullable: true })
  expectedDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount!: number;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
  })
  items!: PurchaseOrderItem[];

  @CreateDateColumn()
  createdAt!: Date;
}
