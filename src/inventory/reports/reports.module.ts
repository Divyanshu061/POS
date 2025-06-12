// src/inventory/reports/reports.module.ts

import { Module } from '@nestjs/common';
import { StockLevelModule } from '../stock-level/stock-level.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { SalesModule } from '../sales/sales.module';

import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [StockLevelModule, PurchaseModule, SalesModule],
  providers: [ReportsService],
  controllers: [ReportsController],
  exports: [ReportsService], // optional: export for use in dashboards etc.
})
export class ReportsModule {}
