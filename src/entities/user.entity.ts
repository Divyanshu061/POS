// src/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Role } from './role.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { Invoice } from '../payment-invoice/entities/invoice.entity';

const SALT_ROUNDS = 10;

@Entity({ name: 'user' })
@Index('IDX_USERS_EMAIL_UNIQUE', ['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Full name of the user */
  @Column({ length: 100 })
  name!: string;

  /** Unique email used for login and notifications */
  @Column({ length: 150 })
  email!: string;

  /** Hashed password (excluded from queries by default) */
  @Column({ select: false })
  password!: string;

  /** Soft-delete flag to deactivate accounts without dropping rows */
  @Column({ default: true })
  isActive!: boolean;

  /** Owning company (foreign key column + relation) */
  @Index()
  @Column('uuid', { nullable: true })
  companyId?: string | null;

  @ManyToOne(() => Company, (c) => c.users, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'companyId' })
  company?: Company | null;

  /** User roles for authorization */
  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];

  @Column({ type: 'int', default: 0 })
  tokenVersion!: number;

  /** Timestamps */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;

  /** Relations */
  @OneToMany(() => Invoice, (invoice) => invoice.creator)
  invoices!: Invoice[];

  /** Lifecycle hooks: hash password before insert/update */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
  }

  /** Utilities */
  hasRole(roleName: string): boolean {
    return this.roles?.some((r) => r.name === roleName) ?? false;
  }

  isSuperAdmin(): boolean {
    return this.hasRole('superadmin');
  }

  async comparePassword(candidate: string): Promise<boolean> {
    if (!this.password) return false; // excluded from default queries
    return bcrypt.compare(candidate, this.password);
  }
}
