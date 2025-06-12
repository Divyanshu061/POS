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
import { StockLevelService } from './stock-level.service';
import { CreateStockLevelDto } from './dto/create-stock-level.dto';
import { UpdateStockLevelDto } from './dto/update-stock-level.dto';

@Controller('inventory/stock-levels')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StockLevelController {
  constructor(private readonly svc: StockLevelService) {}

  @Get('/low-stock')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  lowStock(
    @Query('companyId') companyId: string,
    @Query('threshold') threshold?: string,
  ) {
    const parsedThreshold = threshold ? parseInt(threshold, 10) : 10;
    return this.svc.lowStockReport(companyId, parsedThreshold);
  }
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
  create(@Body() dto: CreateStockLevelDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(@Param('id') id: string, @Body() dto: UpdateStockLevelDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
