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
  async findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.stockLevelService.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateStockLevelDto,
  ) {
    return this.stockLevelService.create(dto, companyId, userId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  async update(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateStockLevelDto,
  ) {
    return this.stockLevelService.update(id, dto, companyId, userId);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.stockLevelService.remove(id, companyId, userId);
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
    @CurrentUser('userId') _userId: string, // kept in signature if you want to log who did it; not passed to service
    @Body() dto: AdjustStockDto,
  ) {
    // do NOT pass userId as the 3rd arg here — third param is EntityManager (optional).
    return this.stockLevelService.adjustStock(dto, companyId);
  }
}
