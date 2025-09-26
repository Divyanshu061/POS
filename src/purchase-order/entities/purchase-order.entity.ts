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
import { Company } from '../../inventory/company/entities/company.entity'; // adjust path

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

  @Column({ unique: false }) // uniqueness enforced by composite index above
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
