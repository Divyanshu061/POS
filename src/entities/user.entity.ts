import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from './role.entity';

export enum UserRole {
  ADMIN = 'admin',
  STORE_MANAGER = 'store_manager',
  SALES_REP = 'sales_rep',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @ManyToMany(() => Role)
  @JoinTable({ name: 'user_roles' })
  roles!: Role[];
}
