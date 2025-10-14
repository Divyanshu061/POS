// src/inventory/company/entities/company.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Product } from '../../product/entities/product.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { StockLevel } from '../../stock-level/entities/stock-level.entity';
import { Client } from '../../../crm/client/entities/client.entity';
import { Invoice } from '../../../payment-invoice/entities/invoice.entity';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';

@Entity({ name: 'companies' })
@Index(['name'], { unique: true })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToMany(() => User, (u) => u.company)
  users?: User[];

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @OneToMany(() => Product, (product) => product.company, {
    cascade: true,
  })
  products!: Product[];

  @OneToMany(() => Transaction, (tx) => tx.company)
  transactions!: Transaction[];

  @OneToMany(() => StockLevel, (sl) => sl.company, {
    cascade: true,
  })
  stockLevels!: StockLevel[];

  @OneToMany(() => Client, (client) => client.company)
  clients!: Client[];

  @OneToMany(() => Invoice, (invoice) => invoice.company)
  invoices!: Invoice[];

  @OneToMany(() => Supplier, (supplier) => supplier.company, {
    cascade: true,
  })
  suppliers!: Supplier[];

  @OneToMany(() => Warehouse, (warehouse) => warehouse.company, {
    cascade: true,
  })
  warehouses!: Warehouse[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
