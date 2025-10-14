// src/inventory/company/company.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  ILike,
  FindOptionsWhere,
  DeepPartial,
  SelectQueryBuilder,
} from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { User } from '../../entities/user.entity';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';

interface FindAllOptions {
  search?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly repo: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateCompanyDto): Promise<Company> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  /**
   * Find all with optional search + pagination.
   * Defaults: page=1, limit=50, returns only active companies (unless includeInactive=true).
   */
  async findAll(opts: FindAllOptions = {}): Promise<{
    data: Company[];
    meta?: { total: number; page: number; limit: number };
  }> {
    const { search, page = 1, limit = 50, includeInactive = false } = opts;

    // Build a strongly-typed where clause immutably to avoid unsafe member access
    let where: FindOptionsWhere<Company> = {};

    if (search) {
      where = { ...where, name: ILike(`%${search}%`) };
    }

    if (!includeInactive) {
      where = { ...where, isActive: true };
    }

    // guard max limit to prevent huge result sets
    const maxLimit = 1000;
    const finalLimit = Math.min(Math.max(1, Number(limit) || 50), maxLimit);
    const finalPage = Math.max(1, Number(page) || 1);

    // If limit is 0 (explicit) return everything matching where (but still respect includeInactive)
    if (limit === 0) {
      const data = await this.repo.find({ where, order: { name: 'ASC' } });
      return { data };
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      take: finalLimit,
      skip: (finalPage - 1) * finalLimit,
      order: { name: 'ASC' },
    });

    return {
      data,
      meta: {
        total,
        page: finalPage,
        limit: finalLimit,
      },
    };
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.repo.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Company with id ${id} not found`);
    }
  }

  /**
   * Deactivate (soft-disable) company.
   */
  async deactivateCompany(id: string): Promise<Company> {
    const company = await this.findOne(id);
    if (!company.isActive) {
      // already inactive — return as-is
      return company;
    }
    company.isActive = false;
    return this.repo.save(company);
  }

  // ---------- existing company-user methods (unchanged) ----------
  async getUsersForCompany(companyId: string): Promise<User[]> {
    await this.findOne(companyId);
    const qb: SelectQueryBuilder<User> = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.company', 'company')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('company.id = :companyId', { companyId });

    return qb.getMany();
  }

  async createUserForCompany(
    companyId: string,
    dto: CreateCompanyUserDto,
  ): Promise<User> {
    const company = await this.findOne(companyId);

    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('User with that email already exists');
    }

    const userPartial: DeepPartial<User> = {
      email: dto.email,
      name: dto.name,
      password: dto.password,
      company,
    };

    const userEntity = this.userRepo.create(userPartial);
    return this.userRepo.save(userEntity);
  }
}
