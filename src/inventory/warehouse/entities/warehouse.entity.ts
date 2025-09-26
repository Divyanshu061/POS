import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Company } from '../../company/entities/company.entity';
import { StockLevel } from '../../stock-level/entities/stock-level.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

@Entity({ name: 'warehouses' })
// index must use the actual column (companyId) not relation name
@Index(['name', 'companyId'], { unique: true })
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // use 'address' because your seed scripts expect `address`
  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  // explicit FK column for tenant scoping (TypeScript + queries)
  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  // ensure the join column name matches the FK property
  @ManyToOne(() => Company, (company) => company.warehouses, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @OneToMany(() => Transaction, (transaction) => transaction.warehouse)
  transactions!: Transaction[];

  @OneToMany(() => StockLevel, (stockLevel) => stockLevel.warehouse)
  stockLevels!: StockLevel[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
