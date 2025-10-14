// src/inventory/inventory.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Company } from '../auth/decorators/company.decorator';

import { StockLevelService } from './stock-level/stock-level.service';
import { ReportsService } from './reports/reports.service';

import { AdjustStockDto } from './stock-level/dto/adjust-stock.dto';

import { StockLevel } from './stock-level/entities/stock-level.entity';
import { LowStockEntry } from './stock-level/types';

/**
 * InventoryController exposes endpoints for products, stock management, and reports:
 * - Product CRUD
 * - Stock adjustments and queries
 * - Low‐stock reporting
 * All routes are secured by JWT authentication and role‐based access.
 */
@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryController {
  constructor(
    private readonly stockSvc: StockLevelService,
    private readonly reportsSvc: ReportsService,
  ) {}

  @Post('stock/adjust')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  async adjustStock(
    @Company() companyId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AdjustStockDto,
  ): Promise<StockLevel> {
    // call stock-level service with the correct signature: (dto, companyId)
    const res = await this.stockSvc.adjustStock(dto, companyId);
    if (!res?.stock) {
      throw new BadRequestException('Failed to adjust stock');
    }
    return res.stock;
  }

  /**
   * Get current stock level for a product in a warehouse
   * GET /inventory/stock/:productId/:warehouseId
   */
  @Get('stock/:productId/:warehouseId')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  getStockLevel(
    @Company() companyId: string,
    @Param('productId', ParseIntPipe) productId: number,
    @Param('warehouseId', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    warehouseId: string,
  ): Promise<StockLevel> {
    return this.stockSvc.getStockLevel(companyId, productId, warehouseId);
  }

  // ─── Reports ─────────────────────────────────────────────────────

  /**
   * Generate low‐stock report
   * GET /inventory/reports/low-stock?threshold=10
   */
  @Get('reports/low-stock')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  lowStockReport(
    @Company() companyId: string,
    @Query('threshold', new DefaultValuePipe(10), ParseIntPipe)
    threshold: number,
  ): Promise<LowStockEntry[]> {
    return this.reportsSvc.lowStockReport(companyId, threshold);
  }
}
