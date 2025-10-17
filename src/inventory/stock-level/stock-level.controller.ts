import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UsePipes,
  UseGuards,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { StockLevelService } from './stock-level.service';
import { CreateStockLevelDto } from './dto/create-stock-level.dto';
import { UpdateStockLevelDto } from './dto/update-stock-level.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { CurrentUser } from '../../auth/decorators/current-user-id.decorator';
import { WarehouseStockQueryDto } from './dto/warehouse-stock-query.dto';

@Controller('inventory/stock-levels')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StockLevelController {
  constructor(private readonly stockLevelService: StockLevelService) {}

  @Get('low-stock')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  async lowStock(
    @CurrentCompany() companyId: string,
    @Query('threshold') threshold?: string,
  ) {
    const parsedThreshold = threshold ? parseInt(threshold, 10) : undefined;
    return this.stockLevelService.lowStockReport(companyId, parsedThreshold);
  }

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  async findAll(@CurrentCompany() companyId: string) {
    return this.stockLevelService.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.stockLevelService.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async create(
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateStockLevelDto,
  ) {
    return this.stockLevelService.create(dto, companyId, userId);
  }

  // PATCH has ValidationPipe now to reject unexpected fields early
  @Patch(':id')
  @Roles('admin', 'store_manager')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateStockLevelDto,
  ) {
    return this.stockLevelService.update(id, dto, companyId, userId);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.stockLevelService.remove(id, companyId, userId);
    return { deleted: true };
  }

  @Post('adjust')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async adjustStock(
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.stockLevelService.adjustStock(dto, companyId, userId);
  }

  @Get(':warehouseId/stock')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getWarehouseStock(
    @CurrentCompany() companyId: string,
    @Param('warehouseId', new ParseUUIDPipe({ version: '4' }))
    warehouseId: string,
    @Query() query: WarehouseStockQueryDto,
  ) {
    const { productId, page, limit } = query;
    return this.stockLevelService.listForWarehouse(companyId, warehouseId, {
      productId,
      page,
      limit,
    });
  }
}
