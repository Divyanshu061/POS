import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  create(dto: CreateSupplierDto): Promise<Supplier> {
    const s = this.repo.create(dto);
    return this.repo.save(s);
  }

  findAll(companyId: string): Promise<Supplier[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Supplier> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Supplier ${id} not found`);
    return s;
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
