import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { StockLevel } from './entities/stock-level.entity';
import { StockLevelService } from './stock-level.service';
import { StockLevelController } from './stock-level.controller';
import { NotificationModule } from '../notification/notification.module';
import { Product } from '../product/entities/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Company } from '../company/entities/company.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockLevel,
      Product,
      Warehouse,
      Company,
      Transaction,
    ]),
    NotificationModule,
    ConfigModule,
  ],
  providers: [StockLevelService],
  controllers: [StockLevelController],
  exports: [StockLevelService],
})
export class StockLevelModule {}
