// src/inventory/company/company.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from './entities/company.entity';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';

import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { Permission } from '../../entities/permission.entity';

import { AuthModule } from '../../auth/auth.module';
import { RolesModule } from '../../roles/roles.module';
import { PermissionsModule } from '../../permissions/permissions.module';

/**
 * The CompanyModule encapsulates all company-related features:
 * - Registers Company, User, Role, and Permission entities with TypeORM
 * - Provides CompanyService for business logic
 * - Declares CompanyController for HTTP routes
 * - Imports Auth, Roles, and Permissions modules for guards & decorators
 */
@Module({
  imports: [
    // Register repositories needed in this module
    TypeOrmModule.forFeature([Company, User, Role, Permission]),

    // Authentication & authorization dependencies
    forwardRef(() => AuthModule),
    RolesModule,
    PermissionsModule,
  ],
  providers: [
    // Business logic for companies
    CompanyService,
  ],
  controllers: [
    // REST endpoints for company operations
    CompanyController,
  ],
  exports: [
    // Expose service for use by other modules (e.g., AnalyticsModule)
    CompanyService,
  ],
})
export class CompanyModule {}
