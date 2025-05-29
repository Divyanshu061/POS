import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Category, (parent) => parent.children, { nullable: true })
  @JoinColumn({ name: 'parentCategoryId' })
  parent?: Category;

  @Column('uuid', { nullable: true })
  parentCategoryId?: string;

  @OneToMany(() => Category, (child) => child.parent)
  children!: Category[];

  @Column('uuid')
  companyId!: string;

  @OneToMany(() => Product, (product) => product.category)
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
