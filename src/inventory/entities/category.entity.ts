import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @ManyToOne(() => Category, (cat) => cat.children, { nullable: true })
  parent?: Category;

  @OneToMany(() => Category, (cat) => cat.parent)
  children!: Category[];

  @OneToMany(() => Product, (p) => p.category)
  products!: Product[];

  @Column('uuid')
  companyId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
