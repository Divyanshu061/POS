// src/roles/roles.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from '../entities/role.entity';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesSvc: RolesService) {}

  /** POST /roles */
  @Post()
  create(@Body() dto: CreateRoleDto): Promise<Role> {
    return this.rolesSvc.create(dto);
  }

  /** GET /roles */
  @Get()
  findAll(): Promise<Role[]> {
    return this.rolesSvc.findAll();
  }

  /** GET /roles/summary */
  @Get('summary')
  async summary(): Promise<{ count: number; roles: string[] }> {
    const all = await this.rolesSvc.findAll();
    return {
      count: all.length,
      roles: all.map((r) => r.name),
    };
  }

  /** GET /roles/:id */
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesSvc.findOne(id);
  }

  /** PATCH /roles/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateRoleDto): Promise<Role> {
    return this.rolesSvc.update(id, dto);
  }

  /** DELETE /roles/:id */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.rolesSvc.remove(id);
  }
}
