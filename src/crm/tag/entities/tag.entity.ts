import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Client } from '../../client/entities/client.entity';

@Entity()
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @ManyToMany(() => Client, (client) => client.tags)
  clients!: Client[];
}
