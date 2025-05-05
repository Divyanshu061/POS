// src/main.ts
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // secure HTTP headers
  app.use(helmet());

  // compress response bodies
  app.use(compression());

  // enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
  });

  // prefix all routes with /api
  app.setGlobalPrefix('api');

  // global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, () => {
    logger.log(`🚀 Server running at http://localhost:${port}/api`);
  });

  // handle unhandled promise rejections (only the reason param)
  process.on('unhandledRejection', (reason: unknown) => {
    if (reason instanceof Error) {
      logger.error('Unhandled Rejection reason: ' + reason.stack);
    } else {
      logger.error('Unhandled Rejection reason: ' + String(reason));
    }
    process.exit(1);
  });

  // handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception: ' + (error.stack ?? error.message));
    process.exit(1);
  });
}

void bootstrap().catch((err) => {
  console.error('❌ Failed to bootstrap application:', err);
  process.exit(1);
});
