// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { InventoryModule } from './inventory/inventory.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { User } from './entities/user.entity';

/**
 * The root application module.
 * Responsibilities:
 * 1. Load global configuration
 * 2. Set up database (TypeORM)
 * 3. Register global validation pipe and guards
 * 4. Register feature modules
 */
@Module({
  imports: [
    // 1) Environment variables loaded globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // 2) Database connection (PostgreSQL) and entity auto-loading
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'pos_system'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<boolean>('TYPEORM_SYNCHRONIZE', false),
        logging: config.get<boolean>('TYPEORM_LOGGING', true),
      }),
    }),

    // 3) Make User repository available for global guards
    TypeOrmModule.forFeature([User]),

    // 4) Feature modules
    AuthModule,
    UserModule,
    RolesModule,
    PermissionsModule,
    InventoryModule,
  ],
  providers: [
    // Global validation for DTOs
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // Swap ClerkAuthGuard for JwtAuthGuard for custom JWT flow
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
