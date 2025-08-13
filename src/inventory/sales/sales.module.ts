// src/inventory/sales/sales.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StockLevelModule } from '../stock-level/stock-level.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem]),
    TransactionModule,
    AuditLogModule,
    StockLevelModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService],
})
export class SalesModule {}
