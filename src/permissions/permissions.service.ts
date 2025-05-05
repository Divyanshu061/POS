// src/permissions/permissions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {}

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const exists = await this.permRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new Error(`Permission "${dto.name}" already exists`);
    const perm = this.permRepo.create(dto);
    return this.permRepo.save(perm);
  }

  findAll(): Promise<Permission[]> {
    return this.permRepo.find();
  }

  async findOne(id: string): Promise<Permission> {
    const perm = await this.permRepo.findOne({ where: { id } });
    if (!perm) throw new NotFoundException(`Permission ${id} not found`);
    return perm;
  }

  async update(id: string, dto: CreatePermissionDto): Promise<Permission> {
    const perm = await this.findOne(id);
    perm.name = dto.name;
    perm.description = dto.description;
    return this.permRepo.save(perm);
  }

  async remove(id: string): Promise<void> {
    const result = await this.permRepo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException(`Permission ${id} not found`);
  }
}
