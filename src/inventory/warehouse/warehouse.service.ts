import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Warehouse } from './entities/warehouse.entity';
import { Company } from '../company/entities/company.entity'; // ✅ fixed import
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async create(dto: CreateWarehouseDto, companyId: string): Promise<Warehouse> {
    const companyExists = await this.companyRepo.exist({
      where: { id: companyId },
    });
    if (!companyExists) {
      throw new NotFoundException(`Company with id ${companyId} not found`);
    }

    const warehouse = this.warehouseRepo.create({
      ...dto,
      companyId, // ✅ directly set FK
    });

    return this.warehouseRepo.save(warehouse);
  }

  async findAll(companyId: string): Promise<Warehouse[]> {
    return this.warehouseRepo.find({
      where: { companyId }, // ✅ simpler filter
      relations: ['company'],
    });
  }

  async findOne(id: string, companyId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({
      where: { id, companyId },
      relations: ['company'],
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with id ${id} not found for company ${companyId}`,
      );
    }
    return warehouse;
  }

  async update(
    id: string,
    dto: UpdateWarehouseDto,
    companyId: string,
  ): Promise<Warehouse> {
    const warehouse = await this.findOne(id, companyId);
    Object.assign(warehouse, dto);
    return this.warehouseRepo.save(warehouse);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const result = await this.warehouseRepo.delete({ id, companyId });
    if (result.affected === 0) {
      throw new NotFoundException(
        `Warehouse with id ${id} not found for company ${companyId}`,
      );
    }
  }
}
