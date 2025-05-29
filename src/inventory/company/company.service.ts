// src/inventory/company/company.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * CompanyService encapsulates business logic for managing companies:
 * - Creation
 * - Retrieval (single/all)
 * - Updates
 * - Deletion
 */
@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,
  ) {}

  /**
   * Create and save a new company entity
   */
  async create(dto: CreateCompanyDto): Promise<Company> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  /**
   * Retrieve all companies
   */
  async findAll(): Promise<Company[]> {
    return this.repo.find();
  }

  /**
   * Retrieve a single company by its UUID
   * @throws NotFoundException if the company does not exist
   */
  async findOne(id: string): Promise<Company> {
    const company = await this.repo.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return company;
  }

  /**
   * Update an existing company's data
   * @throws NotFoundException if the company does not exist
   */
  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id); // ensure it exists
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  /**
   * Remove a company by its UUID
   * @throws NotFoundException if the company does not exist
   */
  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
  }
}
