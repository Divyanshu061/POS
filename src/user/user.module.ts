// src/user/user.module.ts

import { Module, forwardRef, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../entities/user.entity';
import { UserService } from './user.service';
import { UsersController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';

/**
 * The UserModule encapsulates everything related to user management:
 * - Provides UserService to other modules (e.g., AuthModule)
 * - Registers the User repository with TypeORM
 * - Declares UsersController for handling HTTP endpoints
 */
@Global()
@Module({
  imports: [
    // Register User entity for TypeORM
    TypeOrmModule.forFeature([User]),

    // Handle circular dependency between AuthModule and UserModule
    forwardRef(() => AuthModule),

    // Import RolesModule to allow role assignment in UserService
    RolesModule,
  ],
  providers: [UserService],
  controllers: [UsersController],
  exports: [
    // Export both UserService and TypeORM repository for use in other modules
    TypeOrmModule,
    UserService,
  ],
})
export class UserModule {}
