import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Purchase } from './entities/purchase.entity';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase])],
  providers: [PurchaseService],
  controllers: [PurchaseController],
  exports: [PurchaseService],
})
export class PurchaseModule {}
