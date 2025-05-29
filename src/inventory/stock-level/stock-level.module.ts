import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StockLevel } from './entities/stock-level.entity';
import { StockLevelService } from './stock-level.service';
import { StockLevelController } from './stock-level.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StockLevel])],
  providers: [StockLevelService],
  controllers: [StockLevelController],
  exports: [StockLevelService],
})
export class StockLevelModule {}
