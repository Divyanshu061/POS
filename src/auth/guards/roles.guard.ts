// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../../entities/user.entity';

interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.get<string[]>('roles', context.getHandler()) ||
      this.reflector.get<string[]>('roles', context.getClass());

    if (!requiredRoles?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.userId;
    if (!userId) {
      this.logger.warn(`Request missing userId; denying access.`);
      return false;
    }

    try {
      // load user with roles once per request
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found; denying access.`);
        return false;
      }

      const userRoles = user.roles.map((r) => r.name);
      const allowed = requiredRoles.some((r) => userRoles.includes(r));

      if (!allowed) {
        this.logger.warn(
          `User ${userId} roles [${userRoles.join(
            ',',
          )}] do not satisfy [${requiredRoles.join(',')}].`,
        );
      }

      return allowed;
    } catch (err) {
      this.logger.error(
        `Failed role check for user ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      );
      return false;
    }
  }
}
