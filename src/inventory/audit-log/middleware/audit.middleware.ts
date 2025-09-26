// src/inventory/audit-log/middleware/audit.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource, QueryRunner } from 'typeorm';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { userId: string; companyId?: string | null };
    queryRunner?: QueryRunner;
  }
}

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditMiddleware.name);

  constructor(private dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let queryRunner: QueryRunner | undefined;
    try {
      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();

      if (req.user?.userId) {
        queryRunner.data = {
          ...(queryRunner.data ?? {}),
          userId: req.user.userId,
          companyId: req.user.companyId ?? null,
        };
      }

      req.queryRunner = queryRunner;
    } catch (err) {
      // use the error when logging to avoid "defined but never used"
      this.logger.warn(
        'Failed to create QueryRunner for audit middleware — continuing without it',
        (err as Error).message,
      );
    }

    // release runner after response finishes/closes — wrap cleanup invocation so handlers don't return Promise
    const cleanup = async () => {
      if (req.queryRunner) {
        try {
          await req.queryRunner.release();
        } catch (releaseErr) {
          this.logger.error(
            'Failed to release QueryRunner',
            releaseErr as Error,
          );
        } finally {
          req.queryRunner = undefined;
        }
      }
    };

    res.on('finish', () => {
      void cleanup();
    });
    res.on('close', () => {
      void cleanup();
    });

    next();
  }
}
