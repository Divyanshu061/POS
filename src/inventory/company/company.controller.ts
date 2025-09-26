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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enum/user-role.enum';

import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * CompanyController handles all CRUD operations for companies:
 * - Create new company records
 * - Retrieve single or multiple companies
 * - Update existing company data
 * - Delete companies
 *
 * All routes are protected by JWT authentication and role-based authorization.
 * Only users with the SUPER_ADMIN role can access these endpoints.
 */
@Controller('inventory/companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  /**
   * Create a new company
   * POST /inventory/companies
   */
  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCompanyDto,
  ) {
    return this.service.create(dto);
  }

  /**
   * Retrieve all companies
   * GET /inventory/companies
   */
  @Get()
  findAll() {
    return this.service.findAll();
  }

  /**
   * Retrieve a company by ID
   * GET /inventory/companies/:id
   */
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
  ) {
    return this.service.findOne(id);
  }

  /**
   * Update an existing company
   * PATCH /inventory/companies/:id
   */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCompanyDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * Remove a company
   * DELETE /inventory/companies/:id
   */
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    id: string,
  ) {
    return this.service.remove(id);
  }
}
