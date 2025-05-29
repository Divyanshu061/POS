// src/inventory/inventory.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyModule } from './company/company.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { StockLevelModule } from './stock-level/stock-level.module';
import { TransactionModule } from './transaction/transaction.module';
import { SupplierModule } from './supplier/supplier.module';
import { PurchaseModule } from './purchase/purchase.module';
import { SalesModule } from './sales/sales.module';
import { ReportsModule } from './reports/reports.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // no bulk entities, feature modules handle their own
    CompanyModule,
    ProductModule,
    CategoryModule,
    WarehouseModule,
    StockLevelModule,
    TransactionModule,
    SupplierModule,
    PurchaseModule,
    SalesModule,
    ReportsModule,
    AuditLogModule,
  ],
})
export class InventoryModule {}
