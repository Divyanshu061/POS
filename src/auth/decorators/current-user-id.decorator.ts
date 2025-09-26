// src/auth/decorators/current-user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Shape of whatever you attach to `req.user` for your auth system.
 * Export so controllers/services can import the type if needed.
 */
export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  roles: string[];
  // other props you populate...
}

/**
 * Use a type alias (intersection) rather than `interface extends Request`
 * to avoid conflicting with any existing global `Request.user` declaration.
 */
export type RequestWithUser = Request & { user?: AuthenticatedUser | null };

/** Helper for keys of AuthenticatedUser */
export type CurrentUserProperty = keyof AuthenticatedUser;

/**
 * Usage:
 *  @CurrentUser() -> AuthenticatedUser | null
 *  @CurrentUser('email') -> string | null
 */
export const CurrentUser = createParamDecorator(
  (
    property: CurrentUserProperty | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[CurrentUserProperty] | null => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user ?? null;

    if (!user) return null;
    if (property === undefined) return user;
    return user[property];
  },
);
