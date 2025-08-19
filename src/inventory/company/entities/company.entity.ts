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
}
