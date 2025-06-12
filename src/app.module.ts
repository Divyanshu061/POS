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
import { TransactionModule } from './inventory/transaction/transaction.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { User } from './entities/user.entity';

import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

// Import your in-inventory modules (all lowercase “notification”)
import { NotificationModule } from './inventory/notification/notification.module';
import { StockLevelModule } from './inventory/stock-level/stock-level.module';

@Module({
  imports: [
    // ─── 1) Env variables ───────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // ─── 2) Database connection (TypeORM) ──────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'div_09'),
        database: config.get<string>('DB_NAME', 'pos_system'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<boolean>('TYPEORM_SYNCHRONIZE', false),
        logging: config.get<boolean>('TYPEORM_LOGGING', true),
      }),
    }),

    // ─── 3) Make User repository available globally for guards ──────────
    TypeOrmModule.forFeature([User]),

    // ─── 4) Core feature modules ────────────────────────────────────────
    AuthModule,
    UserModule,
    RolesModule,
    PermissionsModule,
    InventoryModule,
    TransactionModule,

    // ─── 5) StockLevel & Notification modules (so they can inject MailerService) ─
    StockLevelModule,
    NotificationModule,

    // ─── 6) Mailer configuration (via env variables) ─────────────────────
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
          port: config.get<number>('SMTP_PORT', 587),
          secure: false,
          auth: {
            user: config.get<string>('SMTP_USER', 'your_email@gmail.com'),
            pass: config.get<string>('SMTP_PASS', 'your_app_password'),
          },
        },
        defaults: {
          from: `"Inventory System" <${config.get<string>('SMTP_FROM', 'no-reply@ims.com')}>`,
        },
        template: {
          // At runtime: __dirname → dist/, so this points to <project-root>/templates/email
          dir: join(__dirname, 'emails'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [
    // ─── Global validation pipe for all incoming DTOs ───────────────────
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // ─── Global guards: JWT authentication & role-based guard ───────────
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
