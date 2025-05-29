import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly repo: Repository<Warehouse>,
  ) {}

  create(dto: CreateWarehouseDto): Promise<Warehouse> {
    const w = this.repo.create(dto);
    return this.repo.save(w);
  }

  findAll(companyId: string): Promise<Warehouse[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Warehouse> {
    const w = await this.repo.findOne({ where: { id } });
    if (!w) throw new NotFoundException(`Warehouse ${id} not found`);
    return w;
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
