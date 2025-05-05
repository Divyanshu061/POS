// src/app.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';

import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';

@Module({
  imports: [
    // 1) Global configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // 2) Core TypeORM setup
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        type: 'postgres',
        host: cs.get<string>('DB_HOST'),
        port: cs.get<number>('DB_PORT'),
        username: cs.get<string>('DB_USERNAME'),
        password: cs.get<string>('DB_PASSWORD'),
        database: cs.get<string>('DB_NAME'),
        entities: [User, Role, Permission],
        synchronize: cs.get<boolean>('TYPEORM_SYNCHRONIZE') ?? false,
        logging: cs.get<boolean>('TYPEORM_LOGGING') ?? false,
      }),
    }),

    // 3) Provide repository tokens at root so global guards can inject
    TypeOrmModule.forFeature([User, Role, Permission]),

    // 4) Application feature modules (circular-safe)
    AuthModule,
    forwardRef(() => UserModule),
    forwardRef(() => RolesModule),
    forwardRef(() => PermissionsModule),
    // InventoryModule,
  ],

  providers: [
    // Global validation pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },

    // Global guards: authenticate then authorize
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
