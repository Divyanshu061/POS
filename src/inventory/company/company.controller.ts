// src/inventory/company/company.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enum/user-role.enum';

import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';

/**
 * CompanyController handles all CRUD operations for companies:
 * - Create new company records
 * - Retrieve single or multiple companies
 * - Update existing company data
 * - Delete companies
 *
 * All routes are protected by JWT authentication and role-based authorization.
 * Only users with the SUPER_ADMIN role can access these endpoints by default.
 */
@Controller('inventory/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCompanyDto,
  ) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    // simple pagination/search passthrough — service will handle defaults
    return this.service.findAll({
      search,
      page: Number(page),
      limit: Number(limit),
      includeInactive: includeInactive === 'true',
    });
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
  ) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCompanyDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
  ) {
    return this.service.remove(id);
  }

  /**
   * List users for a company
   * GET /inventory/companies/:id/users
   */
  @Get(':id/users')
  async getUsersForCompany(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    return this.service.getUsersForCompany(id);
  }

  /**
   * Create a user under the given company (admin convenience)
   * POST /inventory/companies/:id/users
   */
  @Post(':id/users')
  async createUserForCompany(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCompanyUserDto,
  ) {
    return this.service.createUserForCompany(id, dto);
  }

  /**
   * Soft-deactivate a company (set isActive = false).
   * PATCH /inventory/companies/:id/deactivate
   */
  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ) {
    return this.service.deactivateCompany(id);
  }
}
