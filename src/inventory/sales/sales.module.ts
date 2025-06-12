// src/inventory/sales/sales.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sale } from './entities/sale.entity';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale]), // registers the Sale repository
    TransactionModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [SalesService], // so ReportsModule (or others) can inject SalesService
})
export class SalesModule {}
