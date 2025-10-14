// src/inventory/category/category.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from './entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product]), AuditLogModule],
  providers: [CategoryService],
  controllers: [CategoryController],
  exports: [CategoryService],
})
export class CategoryModule {}
