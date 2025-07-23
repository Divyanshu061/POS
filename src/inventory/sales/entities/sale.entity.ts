// src/inventory/sales/entities/sale.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Client } from '../../../crm/client/entities/client.entity';
import { SaleItem } from './sale-item.entity';
import { PaymentMethod } from '../../sales/dto/create-sale.dto';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // --- Header fields ---

  @Column('uuid')
  clientId!: string;

  @ManyToOne(() => Client, { eager: true, nullable: false })
  @JoinColumn({ name: 'clientId' })
  client!: Client;

  @Column('uuid')
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { eager: true, nullable: false })
  @JoinColumn({ name: 'warehouseId' })
  warehouse!: Warehouse;

  @Column('uuid')
  companyId!: string;

  @Column('int')
  totalQuantity!: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount!: number;

  @Column('enum', { enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @Column('decimal', { precision: 12, scale: 2 })
  amountPaid!: number;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'sold_at' })
  soldAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // --- Line items ---

  @OneToMany(() => SaleItem, (item) => item.sale, {
    cascade: ['insert', 'update'],
    eager: true,
  })
  items!: SaleItem[];
}
