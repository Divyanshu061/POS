//File: reporting.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { ReportDefinition } from './entities/report-definition.entity';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { ReportRun } from './entities/report-run.entity';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { Purchase } from '../inventory/purchase/entities/purchase.entity';
import { ProductModule } from '../inventory/product/product.module';
import { Product } from '../inventory/product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportDefinition,
      Dashboard,
      DashboardWidget,
      ReportRun,
      Sale,
      Purchase,
      Product,
    ]),
    ProductModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
