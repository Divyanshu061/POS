// src/roles/roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm'; // ✅ Added In here
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permRepo: Repository<Permission>,
  ) {}

  /** Create a new Role with given permissions */
  async create(dto: CreateRoleDto): Promise<Role> {
    const perms = await this.permRepo.findByIds(dto.permissionIds);
    if (perms.length !== dto.permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }
    const role = this.roleRepo.create({
      name: dto.name,
      permissions: perms,
    });
    return this.roleRepo.save(role);
  }

  /** List all roles (with their permissions) */
  findAll(): Promise<Role[]> {
    return this.roleRepo.find({ relations: ['permissions'] });
  }

  /** Find one role by ID */
  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['permissions'],
    });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  /** Update a role’s name or permissions */
  async update(id: string, dto: CreateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    const perms = await this.permRepo.findByIds(dto.permissionIds);
    role.name = dto.name;
    role.permissions = perms;
    return this.roleRepo.save(role);
  }

  /** Remove a role */
  async remove(id: string): Promise<void> {
    await this.roleRepo.delete(id);
  }

  /** Find roles by names */
  async findByNames(names: string[]): Promise<Role[]> {
    return this.roleRepo.findBy({ name: In(names) }); // ✅ Uses In from TypeORM
  }
}
