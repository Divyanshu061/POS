import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  RelationId,
  Index,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Warehouse } from '../../warehouse/entities/warehouse.entity';
import { Company } from '../../company/entities/company.entity';

export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Index(['companyId', 'createdAt'])
@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Company that owns this transaction */
  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => Company, (company) => company.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  /** Reference to the Product */
  @Column({ type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, (product) => product.transactions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product!: Product;

  /** Reference to the Warehouse */
  @Column({ type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.transactions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouseId' })
  warehouse!: Warehouse;

  /** Type of transaction */
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  /** Quantity involved in this transaction */
  @Column('int')
  quantity!: number;

  /** Optional reference or note */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reference?: string;

  /** When this transaction was created */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** When this transaction was last updated */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /** Relation IDs for quick access without loading entities */
  @RelationId((transaction: Transaction) => transaction.product)
  readonly productIdRelation!: string;

  @RelationId((transaction: Transaction) => transaction.warehouse)
  readonly warehouseIdRelation!: string;

  @RelationId((transaction: Transaction) => transaction.company)
  readonly companyIdRelation!: string;
}
