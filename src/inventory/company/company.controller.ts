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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('inventory/companies')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompanyController {
  constructor(private readonly svc: CompanyService) {}

  @Post()
  @Roles('admin')
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateCompanyDto,
  ) {
    return this.svc.create(dto);
  }

  @Get()
  @Roles('admin', 'store_manager')
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Roles('admin', 'store_manager')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateCompanyDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
