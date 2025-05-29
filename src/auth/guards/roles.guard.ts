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
      this.reflector.get<string[]>('roles', context.getHandler()) ??
      this.reflector.get<string[]>('roles', context.getClass());

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.userId;

    if (!userId) {
      this.logger.warn('Request missing userId; denying access.');
      return false;
    }

    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        this.logger.warn(`User with ID "${userId}" not found; denying access.`);
        return false;
      }

      if (!user.roles || !Array.isArray(user.roles)) {
        this.logger.error(
          `User ${userId} fetched without roles or roles is not an array. Value: ${JSON.stringify(user.roles)}`,
        );
        return false;
      }

      const userRoles = user.roles.map((role) => role.name);
      this.logger.log(
        `Fetched roles for user ${userId}: [${userRoles.join(', ')}]`,
      );

      const isAllowed = requiredRoles.some((role) => userRoles.includes(role));

      if (!isAllowed) {
        this.logger.warn(
          `Access denied: User ${userId} has roles [${userRoles.join(
            ', ',
          )}], but required roles are [${requiredRoles.join(', ')}].`,
        );
      }

      return isAllowed;
    } catch (error) {
      this.logger.error(
        `Failed role check for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
