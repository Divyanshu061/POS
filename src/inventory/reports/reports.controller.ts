// src/inventory/reports/reports.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';

@ApiTags('Inventory Reports')
@ApiBearerAuth()
@Controller('inventory/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsSvc: ReportsService) {}

  @Get('low-stock')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiQuery({ name: 'threshold', required: false })
  @ApiOperation({ summary: 'Get low stock report' })
  async lowStock(
    @Query('companyId') companyId: string,
    @Query('threshold') threshold?: string,
  ) {
    const t = threshold ? Number(threshold) : 10;
    return this.reportsSvc.lowStockReport(companyId, t);
  }

  @Get('purchases')
  @Roles('admin', 'store_manager')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiOperation({ summary: 'Get purchase report' })
  async purchases(@Query('companyId') companyId: string) {
    return this.reportsSvc.purchaseReport(companyId);
  }

  @Get('sales')
  @Roles('admin', 'store_manager', 'sales_rep')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiOperation({ summary: 'Get sales report' })
  async sales(@Query('companyId') companyId: string) {
    return this.reportsSvc.salesReport(companyId);
  }

  @Get('purchases/summary')
  @Roles('admin', 'store_manager')
  @ApiQuery({ name: 'companyId', required: true })
  @ApiOperation({ summary: 'Get summarized purchase report by product' })
  async purchaseSummary(@Query('companyId') companyId: string) {
    return this.reportsSvc.purchaseSummary(companyId);
  }
}
