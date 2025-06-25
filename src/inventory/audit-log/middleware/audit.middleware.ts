// src/inventory/audit-log/middleware/audit.middleware.ts

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource, QueryRunner } from 'typeorm';

// Extend the Request interface to include authenticated user info and the QueryRunner
declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: string };
    queryRunner?: QueryRunner;
  }
}

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private dataSource: DataSource) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Create a new QueryRunner for this request context
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();

    // Attach userId to runner.data if available
    if (req.user?.userId) {
      queryRunner.data = {
        ...(queryRunner.data ?? {}),
        userId: req.user.userId,
      };
    }

    // Store the runner on the request for later retrieval in subscribers
    req.queryRunner = queryRunner;

    await queryRunner.connect().catch(() => {
      // If connection fails, skip attaching the runner
      return;
    });

    next();
  }
}
