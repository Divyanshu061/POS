// src/inventory/sales/sales.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto';

@Controller('inventory/sales')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get()
  @Roles('admin', 'store_manager', 'sales_rep')
  findAll(@Query('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'sales_rep')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'store_manager', 'sales_rep')
  create(@Body() dto: CreateSaleDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(@Param('id') id: string, @Body() dto: UpdateSaleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
