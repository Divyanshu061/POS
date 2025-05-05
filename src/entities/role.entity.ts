// src/entities/role.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Permission } from './permission.entity';
@Entity()
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  @Column({ unique: true })
  name!: string; // e.g. "admin"

  @ManyToMany(() => Permission)
  @JoinTable({ name: 'role_permissions' })
  permissions!: Permission[];
}
