import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // or MongooseModule
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Product } from './entities/product.entity';
import { StockLevel } from './entities/stock-level.entity';
import { Transaction } from './entities/transaction.entity';
import { Category } from './entities/category.entity';
import { Warehouse } from './entities/warehouse.entity';
import { Supplier } from './entities/supplier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      StockLevel,
      Transaction,
      Category,
      Warehouse,
      Supplier,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
