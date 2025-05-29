// src/product/product.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

// Import UserModule so authorization guards can inject the User repository
import { UserModule } from '../../user/user.module';

/**
 * The ProductModule encapsulates all product-related logic:
 * - Registers the Product entity with TypeORM
 * - Provides ProductService for business logic
 * - Declares ProductController for handling HTTP endpoints
 * - Imports UserModule so that global RolesGuard can access Repository<User>
 */
@Module({
  imports: [
    // Register Product repository for dependency injection
    TypeOrmModule.forFeature([Product]),

    // Provide User repository in this module context (needed by RolesGuard)
    UserModule,
  ],
  providers: [
    // Business logic layer for products
    ProductService,
  ],
  controllers: [
    // API layer for product routes
    ProductController,
  ],
  exports: [
    // Make ProductService available to other modules (e.g., OrderModule)
    ProductService,
  ],
})
export class ProductModule {}
