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
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from './role.entity';

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

  /** Hashed password, excluded from queries by default */
  @Column({ select: false })
  password!: string;

  /** Soft-delete flag to deactivate accounts without dropping rows */
  @Column({ default: true })
  isActive!: boolean;

  /** User roles for authorization, loaded eagerly */
  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];

  /** Timestamp when the user was created */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Timestamp when the user was last updated */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /** Soft-delete timestamp; set when user is deactivated */
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;

  /** Lifecycle hook: hash password before inserting/updating */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
  }

  /** Compare plaintext password with stored hash */
  async comparePassword(candidate: string): Promise<boolean> {
    // Make sure to select password when querying
    return bcrypt.compare(candidate, this.password);
  }
}
