import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Company } from '../company/entities/company.entity';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto, companyId: string): Promise<Supplier> {
    const supplier = this.repo.create({
      ...dto,
      company: { id: companyId } as Company, // typed instead of `any`
    });
    return this.repo.save(supplier);
  }

  async findAll(companyId: string): Promise<Supplier[]> {
    return this.repo.find({
      where: { company: { id: companyId } },
      relations: ['company'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.repo.findOne({
      where: { id, company: { id: companyId } },
      relations: ['company'],
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found for this company`);
    }
    return supplier;
  }

  async update(
    id: string,
    dto: UpdateSupplierDto,
    companyId: string,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id, companyId);
    Object.assign(supplier, dto);
    return this.repo.save(supplier);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const supplier = await this.findOne(id, companyId);
    await this.repo.remove(supplier);
  }
}
