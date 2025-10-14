// src/inventory/supplier/entities/supplier.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';
import { Company } from '../../company/entities/company.entity';
import { SupplierContact } from './supplier-contact.entity';

@Entity({ name: 'supplier' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  contactNumber?: string; // keep lightweight primary contact

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'uuid' })
  @Index()
  companyId!: string;

  @ManyToOne(() => Company, (company) => company.suppliers, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'companyId' })
  company!: Company;

  @OneToMany(() => Product, (product) => product.supplier)
  products!: Product[];

  @OneToMany(() => SupplierContact, (contact) => contact.supplier, {
    cascade: false,
    eager: false,
  })
  contacts!: SupplierContact[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
