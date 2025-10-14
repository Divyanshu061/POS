// src/inventory/supplier/entities/supplier-contact.entity.ts
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
import { Supplier } from './supplier.entity';

@Entity({ name: 'supplier_contact' })
export class SupplierContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: false, name: 'isPrimary' })
  isPrimary!: boolean;

  @Column({ type: 'uuid' })
  @Index()
  supplierId!: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.contacts, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'supplierId' })
  supplier!: Supplier;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
