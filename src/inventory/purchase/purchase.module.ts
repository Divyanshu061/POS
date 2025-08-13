// src/inventory/purchase/purchase.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Purchase } from './entities/purchase.entity';
import { Product } from '../product/entities/product.entity';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { TransactionModule } from '../transaction/transaction.module';
import { StockLevelModule } from '../stock-level/stock-level.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Product]),
    TransactionModule,
    StockLevelModule,
  ],
  providers: [PurchaseService],
  controllers: [PurchaseController],
  exports: [PurchaseService],
})
export class PurchaseModule {}
