// src/main.ts
import 'reflect-metadata'; // ← must be first for decorators
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // ─── Security & Performance ──────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  // ─── Global Prefix & Versioning ──────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ─── Validation ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger / OpenAPI ────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('POS & Inventory API')
    .setDescription(
      'Endpoints for Products, Categories, Warehouses, Stock & Transactions',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });
  logger.log('Swagger ready at /api/docs');

  // ─── Start Server ─────────────────────────────────────────────
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  logger.log(`🚀 Server listening at http://localhost:${port}/api (v1)`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed:', err);
  process.exit(1);
});
