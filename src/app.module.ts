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
import { InventoryModule } from './inventory/inventory.module'; // ← added

import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    // 1) Load environment variables globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // 2) Configure TypeORM asynchronously using ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'postgres'),
        password: config.get<string>('POSTGRES_PASSWORD', 'div_09'),
        database: config.get<string>('POSTGRES_DATABASE', 'pos_system'),
        // Automatically load all entities in the project
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Use environment flags for schema sync and logging
        synchronize: config.get<boolean>('TYPEORM_SYNCHRONIZE', true),
        logging: config.get<boolean>('TYPEORM_LOGGING', true),
        // Optionally add migrations path        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),

    // 3) Feature modules (each module registers its own repositories via TypeOrmModule.forFeature)
    AuthModule,
    UserModule,
    RolesModule,
    PermissionsModule,
    InventoryModule, // ← added
  ],
  providers: [
    // Global validation pipe: strips unknown props, forbids non-whitelisted, auto-transforms
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // Global guards: first Clerk authentication, then role-based authorization
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
