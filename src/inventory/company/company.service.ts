// src/inventory/company/company.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
  ) {}

  create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.repo.create(dto);
    return this.repo.save(company);
  }

  findAll(): Promise<Company[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Company> {
    const comp = await this.repo.findOne({ where: { id } });
    if (!comp) throw new NotFoundException(`Company ${id} not found`);
    return comp;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException(`Company ${id} not found`);
  }
}
