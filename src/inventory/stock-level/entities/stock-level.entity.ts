import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';

@Entity({ name: 'stock_levels' })
@Index(['companyId', 'productId', 'warehouseId'], { unique: true })
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ─── Foreign Key: Product ───────────────────────────────────────────────
  @Column({ type: 'int' })
  @Index()
  productId!: number;

  @ManyToOne(() => Product, (p) => p.stockLevels, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  // ─── Foreign Key: Warehouse ─────────────────────────────────────────────
  @Column({ type: 'uuid' })
  @Index()
  warehouseId!: string;

  @ManyToOne(() => Warehouse, (w) => w.stockLevels, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouseId' })
  warehouse!: Warehouse;

  // ─── Foreign Key: Company (Multi-Tenant Support) ────────────────────────
  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.stockLevels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  // ─── Inventory Fields ───────────────────────────────────────────────────
  @Column('int', { default: 0 })
  quantity!: number;

  @Column('int', { default: 10 })
  reorderLevel!: number;

  // ─── Audit Fields ───────────────────────────────────────────────────────
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
