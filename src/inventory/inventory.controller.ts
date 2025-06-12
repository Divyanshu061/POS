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
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Company } from '../auth/decorators/company.decorator';

import { ProductService } from './product/product.service';
import { StockLevelService } from './stock-level/stock-level.service';
import { ReportsService } from './reports/reports.service';

import { CreateProductDto } from './product/dto/create-product.dto';
import { UpdateProductDto } from './product/dto/update-product.dto';
import { AdjustStockDto } from './stock-level/dto/adjust-stock.dto';

import { Product } from './product/entities/product.entity';
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
    private readonly productSvc: ProductService,
    private readonly stockSvc: StockLevelService,
    private readonly reportsSvc: ReportsService,
  ) {}

  // ─── Products ────────────────────────────────────────────────────

  /**
   * List products with pagination
   * GET /inventory/products?skip=0&take=20
   */
  @Get('products')
  @Roles('admin', 'store_manager', 'sales_rep')
  findAllProducts(
    @Company() companyId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(20), ParseIntPipe) take: number,
  ): Promise<Product[]> {
    return this.productSvc.findAll(companyId, { skip, take });
  }

  /**
   * Get a single product by ID
   * GET /inventory/products/:id
   */
  @Get('products/:id')
  @Roles('admin', 'store_manager', 'sales_rep')
  findProduct(
    @Company() companyId: string,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<Product> {
    return this.productSvc.findOne(companyId, id);
  }

  /**
   * Create a new product
   * POST /inventory/products
   */
  @Post('products')
  @Roles('admin', 'store_manager')
  createProduct(
    @Company() companyId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateProductDto,
  ): Promise<Product> {
    return this.productSvc.create(companyId, dto);
  }

  /**
   * Update an existing product
   * PATCH /inventory/products/:id
   */
  @Patch('products/:id')
  @Roles('admin', 'store_manager')
  updateProduct(
    @Company() companyId: string,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productSvc.update(companyId, id, dto);
  }

  /**
   * Delete a product
   * DELETE /inventory/products/:id
   */
  @Delete('products/:id')
  @Roles('admin')
  deleteProduct(
    @Company() companyId: string,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
  ): Promise<void> {
    return this.productSvc.remove(companyId, id);
  }

  // ─── Stock Adjustment ───────────────────────────────────────────

  /**
   * Adjust stock for a product in a warehouse
   * POST /inventory/stock/adjust
   */
  @Post('stock/adjust')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  adjustStock(
    @Company() companyId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: AdjustStockDto,
  ): Promise<StockLevel> {
    return this.stockSvc.adjustStock({ ...dto, companyId });
  }

  /**
   * Get current stock level for a product in a warehouse
   * GET /inventory/stock/:productId/:warehouseId
   */
  @Get('stock/:productId/:warehouseId')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  getStockLevel(
    @Company() companyId: string,
    @Param('productId', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    productId: string,
    @Param('warehouseId', new ParseUUIDPipe({ errorHttpStatusCode: 400 }))
    warehouseId: string,
  ): Promise<StockLevel> {
    return this.stockSvc.getStockLevel(companyId, productId, warehouseId);
  }

  // ─── Reports ─────────────────────────────────────────────────────

  /**
   * Generate low‐stock report
   * GET /inventory/reports/low‐stock?threshold=10
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
