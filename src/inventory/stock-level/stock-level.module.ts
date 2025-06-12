import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StockLevel } from './entities/stock-level.entity';
import { StockLevelService } from './stock-level.service';
import { StockLevelController } from './stock-level.controller';
import { NotificationModule } from '../notification/notification.module';
import { Product } from '../product/entities/product.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([StockLevel, Product]),
    NotificationModule,
  ],
  providers: [StockLevelService],
  controllers: [StockLevelController],
  exports: [StockLevelService],
})
export class StockLevelModule {}
