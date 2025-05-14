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

@Entity('user')
@Index('IDX_USER_EMAIL', ['email'], { unique: true }) // index for fast lookup
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  @Index() // secondary index if you filter often
  email!: string;

  /**
   * Store the bcrypt hash only when explicitly selected
   */
  @Column({ select: false })
  password!: string;

  /**
   * Soft-delete flag; you can also filter on this in repositories
   */
  @Column({ default: true })
  isActive!: boolean;

  /**
   * Many-to-many relation to Role.
   * Cascade is optional—only use if you plan to create Roles inline.
   */
  @ManyToMany(() => Role, { cascade: false, eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles!: Role[];

  /** Auditing columns */
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  /** Before saving, hash any new or modified password */
  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
  }

  /**
   * Compare a plain text password against the stored hash.
   * Use in your AuthService instead of raw bcrypt.compare.
   */
  async comparePassword(candidate: string): Promise<boolean> {
    // `password` must be explicitly selected when querying
    return bcrypt.compare(candidate, this.password);
  }
}
