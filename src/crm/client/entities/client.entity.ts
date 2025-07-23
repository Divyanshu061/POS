// src/crm/client/entities/client.entity.ts

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
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../../../entities/user.entity';
import { Tag } from '../../tag/entities/tag.entity';
import { Invoice } from '../../../payment-invoice/entities/invoice.entity'; // ← add this

export enum ClientStatus {
  LEAD = 'lead',
  PROSPECT = 'prospect',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Index(['ownerId', 'email'], { unique: true })
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true })
  title?: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({
    type: 'enum',
    enum: ClientStatus,
    default: ClientStatus.LEAD,
  })
  status!: ClientStatus;

  // — Owner / Sales‑Rep relationship —
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: false })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column('uuid')
  ownerId!: string;

  // — Timestamps & Soft‑Delete —
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // — Tags (many‑to‑many) —
  @ManyToMany(() => Tag, (tag) => tag.clients, { cascade: true })
  @JoinTable({
    name: 'client_tags',
    joinColumn: { name: 'client_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  // — Invoices (one‑to‑many) —
  @OneToMany(() => Invoice, (invoice) => invoice.client)
  invoices!: Invoice[];
}
