// src/user/user.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../entities/user.entity';
import { UserService } from './user.service';
import { UsersController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';

/**
 * The UserModule encapsulates everything related to user management:
 * - Provides UserService to other modules (e.g. AuthModule)
 * - Registers the User repository with TypeORM
 * - Declares UsersController for HTTP endpoints
 */
@Module({
  imports: [
    // Only register the User entity here; Role logic lives in RolesModule
    TypeOrmModule.forFeature([User]),

    // Allow AuthModule ↔ UserModule circular injection
    forwardRef(() => AuthModule),

    // Bring in RolesModule so UserService can assign roles by name/ID
    RolesModule,
  ],
  providers: [UserService],
  controllers: [UsersController],
  exports: [
    // Export UserService for AuthModule (and any other module) to inject
    TypeOrmModule,
    UserService,
  ],
})
export class UserModule {}
