// src/inventory/supplier/supplier.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('inventory/suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SupplierController {
  constructor(private readonly svc: SupplierService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(@CurrentCompany() companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreateSupplierDto, @CurrentCompany() companyId: string) {
    return this.svc.create(dto, companyId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.update(id, dto, companyId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.remove(id, companyId);
  }
}
