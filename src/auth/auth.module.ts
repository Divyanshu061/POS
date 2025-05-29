// src/auth/auth.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

import { UserModule } from '../user/user.module';
import { RolesModule } from '../roles/roles.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

/**
 * The AuthModule encapsulates JWT-based authentication and authorization.
 * It registers the Passport JWT strategy, JWT module, and global guards.
 */
@Module({
  imports: [
    // Shared configuration is loaded at the AppModule level; here we import ConfigModule for token settings
    ConfigModule,

    // TypeORM entities for user, role, and permission lookups in guards and strategy
    TypeOrmModule.forFeature([User, Role, Permission]),

    // Circular dependency resolution for User, Roles, and Permissions modules
    forwardRef(() => UserModule),
    forwardRef(() => RolesModule),
    forwardRef(() => PermissionsModule),

    // Passport sets up JWT as default strategy, no session storage
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),

    // JWT token configuration (secret and expiry) pulled from ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRATION') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,

    // Apply JWTAuthGuard and RolesGuard globally
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
