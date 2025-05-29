import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  RelationId,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';

@Entity({ name: 'stock_levels' })
@Index(['companyId', 'productId', 'warehouseId'], { unique: true })
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Foreign key column for product */
  @Column({ type: 'uuid' })
  @Index()
  productId!: string;

  @ManyToOne(() => Product, (p) => p.stockLevels, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  /** Foreign key column for warehouse */
  @Column({ type: 'uuid' })
  @Index()
  warehouseId!: string;

  @ManyToOne(() => Warehouse, (w) => w.stockLevels, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouseId' })
  warehouse!: Warehouse;

  /** Multi-tenant identifier */
  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => Company, (c) => c.stockLevels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  /** Current quantity on hand */
  @Column('int', { default: 0 })
  quantity!: number;

  /** When this record was created */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** When this record was last updated */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /** RelationId shortcuts for lightweight access */
  @RelationId((sl: StockLevel) => sl.product)
  readonly productIdRelation!: string;

  @RelationId((sl: StockLevel) => sl.warehouse)
  readonly warehouseIdRelation!: string;

  @RelationId((sl: StockLevel) => sl.company)
  readonly companyIdRelation!: string;
}
