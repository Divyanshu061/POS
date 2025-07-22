import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from '../entities/dashboard.entity';
import { CreateDashboardDto } from '../dto/create-dashboard.dto';
import { UpdateDashboardDto } from '../dto/update-dashboard.dto';
import { Company } from '../../inventory/company/entities/company.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Dashboard)
    private dashboardRepo: Repository<Dashboard>,

    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {}

  async create(dto: CreateDashboardDto, companyId: string) {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
    });

    if (!company) throw new NotFoundException('Company not found');

    const dashboard = this.dashboardRepo.create({
      name: dto.name,
      isDefault: dto.isDefault || false,
      company,
    });

    return this.dashboardRepo.save(dashboard);
  }

  async findAll() {
    return this.dashboardRepo.find({
      relations: ['widgets'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id },
      relations: ['widgets'],
    });

    if (!dashboard) throw new NotFoundException('Dashboard not found');

    return dashboard;
  }

  async update(id: string, dto: UpdateDashboardDto) {
    const dashboard = await this.dashboardRepo.findOne({ where: { id } });

    if (!dashboard) throw new NotFoundException('Dashboard not found');

    Object.assign(dashboard, dto);

    return this.dashboardRepo.save(dashboard);
  }

  async remove(id: string) {
    const dashboard = await this.dashboardRepo.findOne({ where: { id } });

    if (!dashboard) throw new NotFoundException('Dashboard not found');

    await this.dashboardRepo.remove(dashboard);

    return { message: 'Dashboard deleted successfully' };
  }
}
