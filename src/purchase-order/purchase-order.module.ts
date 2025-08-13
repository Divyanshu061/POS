// purchase-order.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { User } from '../entities/user.entity';
import { StockLevelModule } from '../inventory/stock-level/stock-level.module';
import { TransactionModule } from '../inventory/transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      Supplier,
      Warehouse,
      Product,
      User,
    ]),
    StockLevelModule,
    TransactionModule,
  ],
  providers: [PurchaseOrderService],
  controllers: [PurchaseOrderController],
})
export class PurchaseOrderModule {}
