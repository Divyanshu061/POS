// src/auth/auth.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ClerkStrategy } from './strategies/clerk.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';
import { RolesGuard } from './guards/roles.guard';

import { UserModule } from '../user/user.module';
import { RolesModule } from '../roles/roles.module';
import { PermissionsModule } from '../permissions/permissions.module';

import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

/**
 * AuthModule handles authentication & authorization:
 * - Global configuration of JWT and Passport
 * - Provides AuthService for token issuance & validation
 * - Applies global guards: ClerkAuthGuard (authentication) and RolesGuard (authorization)
 */
@Module({
  imports: [
    // load .env and make ConfigService available app-wide
    ConfigModule.forRoot({ isGlobal: true }),

    // break circular dependency: AuthService ↔ UserService
    forwardRef(() => UserModule),

    // ensure roles & permissions services are available to Guards
    forwardRef(() => RolesModule),
    forwardRef(() => PermissionsModule),

    // Passport setup with Clerk strategy, no sessions
    PassportModule.register({ defaultStrategy: 'clerk', session: false }),

    // JWT configuration async and global
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION') },
      }),
    }),

    // register TypeORM repositories for direct injection in Guards/Strategies
    TypeOrmModule.forFeature([User, Role, Permission]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ClerkStrategy,
    JwtStrategy,

    // first authenticate requests, then enforce roles
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule {}
