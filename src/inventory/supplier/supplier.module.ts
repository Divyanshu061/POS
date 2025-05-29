import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Supplier } from './entities/supplier.entity';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier])],
  providers: [SupplierService],
  controllers: [SupplierController],
  exports: [SupplierService],
})
export class SupplierModule {}
