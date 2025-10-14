// src/inventory/supplier/supplier.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Supplier } from './entities/supplier.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { SupplierService } from './supplier.service';
import { SupplierContactService } from './supplier-contact.service';
import { SupplierController } from './supplier.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, SupplierContact])],
  providers: [SupplierService, SupplierContactService],
  controllers: [SupplierController],
  exports: [SupplierService, SupplierContactService],
})
export class SupplierModule {}
