// src/inventory/product/product.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entities/product.entity';
import { Category } from '../category/entities/category.entity';
import { Supplier } from '../supplier/entities/supplier.entity';

import { ProductService } from './product.service';
import { ProductController } from './product.controller';

// Import UserModule so authorization guards can inject the User repository
import { UserModule } from '../../user/user.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    // register Product, Category, Supplier repositories for injection
    TypeOrmModule.forFeature([Product, Category, Supplier]),
    AuditLogModule,
    // provide User repository in this module context (needed by RolesGuard)
    UserModule,
  ],
  providers: [ProductService],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
