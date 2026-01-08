// src/purchase-order/entities/purchase-order.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Supplier } from '../../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../../inventory/warehouse/entities/warehouse.entity';
import { User } from '../../entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderStatus } from '../enums/purchase-order-status.enum';
import { Company } from '../../inventory/company/entities/company.entity';

// Ensure orderNumber uniqueness per company
@Index(['companyId', 'orderNumber'], { unique: true })
@Entity('purchase_order')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Company, { eager: false })
  @JoinColumn({ name: 'company_id' })
  company?: Company;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'order_number', unique: false })
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

  @Column({ type: 'date', name: 'order_date' })
  orderDate!: Date;

  @Column({ type: 'date', nullable: true, name: 'expected_date' })
  expectedDate?: Date | null;

  /**
   * decimal in DB — keep as string in TS to avoid precision / parsing surprises.
   * Use service-level conversion when doing arithmetic (e.g. parseFloat or Decimal.js).
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: '0.00',
    name: 'total_amount',
  })
  totalAmount!: string;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, {
    cascade: true,
    // Consider setting eager: false if you expect large lists; current service
    // loads items explicitly via relations in queries so default is fine.
  })
  items!: PurchaseOrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
