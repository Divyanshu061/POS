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
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Controller('inventory/warehouses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WarehouseController {
  constructor(private readonly svc: WarehouseService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(@Query('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'store_manager')
  create(@Body() dto: CreateWarehouseDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
