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
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Controller('inventory/warehouses')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WarehouseController {
  constructor(private readonly svc: WarehouseService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(
    @CurrentCompany() companyId: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const q = {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.svc.findAll(companyId, q);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreateWarehouseDto, @CurrentCompany() companyId: string) {
    return this.svc.create(dto, companyId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.update(id, dto, companyId);
  }

  /**
   * DELETE:
   * - default: blocked if dependents exist (returns helpful 400 with dependentCount & sample)
   * - with ?force=true: deletes dependents then deletes warehouse (destructive)
   */
  @Delete(':id')
  @Roles('admin')
  remove(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @Query('force') force?: string,
  ) {
    const shouldForce = force === 'true';
    return this.svc.remove(id, companyId, shouldForce);
  }
}
