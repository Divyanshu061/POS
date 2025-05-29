// src/auth/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Whatever shape you attach to req.user
 */
interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  roles: string[];
  // …any other props you populate
}

/**
 * Extend the Express Request so `user` is known
 */
interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Usage:
 *   @CurrentUser()            → AuthenticatedUser | null
 *   @CurrentUser('email')     → string | null
 */
export const CurrentUser = createParamDecorator(
  // first argument: the "data" you pass in (a key of AuthenticatedUser)
  // second argument: the ExecutionContext
  (property: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user ?? null;

    if (!user) {
      return null;
    }

    return property ? user[property] : user;
  },
);
