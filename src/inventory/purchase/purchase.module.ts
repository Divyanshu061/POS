import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Purchase } from './entities/purchase.entity';
import { Product } from '../product/entities/product.entity';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { TransactionModule } from '../transaction/transaction.module'; // ← import this

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, Product]),
    TransactionModule, // ← add here
  ],
  providers: [PurchaseService],
  controllers: [PurchaseController],
  exports: [PurchaseService],
})
export class PurchaseModule {}
