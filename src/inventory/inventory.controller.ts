// src/inventory/inventory.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { ProductService } from './product/product.service';
import { StockLevelService } from './stock-level/stock-level.service';
import { ReportsService } from './reports/reports.service';

import { CreateProductDto } from './product/dto/create-product.dto';
import { UpdateProductDto } from './product/dto/update-product.dto';
import { AdjustStockDto } from './stock-level/dto/adjust-stock.dto';

import { Product } from './product/entities/product.entity';
import { StockLevel } from './stock-level/entities/stock-level.entity';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InventoryController {
  constructor(
    private readonly productSvc: ProductService,
    private readonly stockSvc: StockLevelService,
    private readonly reportsSvc: ReportsService,
  ) {}

  // ─── Products ────────────────────────────────────────────────────

  @Get('products')
  @Roles('admin', 'store_manager', 'sales_rep')
  async findAllProducts(
    @Query('companyId') companyId: string,
  ): Promise<Product[]> {
    return this.productSvc.findAll(companyId);
  }

  @Get('products/:id')
  @Roles('admin', 'store_manager', 'sales_rep')
  async findProduct(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
  ): Promise<Product> {
    return this.productSvc.findOne(companyId, id);
  }

  @Post('products')
  @Roles('admin', 'store_manager')
  async createProduct(
    @Body() dto: CreateProductDto,
    @Query('companyId') companyId: string,
  ): Promise<Product> {
    return this.productSvc.create({ ...dto, companyId });
  }

  @Patch('products/:id')
  @Roles('admin', 'store_manager')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Query('companyId') companyId: string,
  ): Promise<Product> {
    return this.productSvc.update(companyId, id, dto);
  }

  @Delete('products/:id')
  @Roles('admin')
  async deleteProduct(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
  ): Promise<void> {
    await this.productSvc.remove(companyId, id);
  }

  // ─── Stock ───────────────────────────────────────────────────────

  @Post('stock/adjust')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  async adjustStock(
    @Body() dto: AdjustStockDto,
    @Query('companyId') companyId: string,
  ): Promise<StockLevel> {
    return this.stockSvc.adjustStock({ ...dto, companyId });
  }

  @Get('stock/:productId/:warehouseId')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  async getStockLevel(
    @Param('productId') productId: string,
    @Param('warehouseId') warehouseId: string,
    @Query('companyId') companyId: string,
  ): Promise<StockLevel> {
    return this.stockSvc.getStockLevel(companyId, productId, warehouseId);
  }

  // ─── Reports ─────────────────────────────────────────────────────

  @Get('reports/low-stock')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  async lowStockReport(
    @Query('companyId') companyId: string,
    @Query('threshold', new DefaultValuePipe(10), ParseIntPipe)
    threshold: number,
  ): Promise<StockLevel[]> {
    return this.reportsSvc.lowStockReport(companyId, threshold);
  }
}
