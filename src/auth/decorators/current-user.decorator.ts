// src/auth/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * @CurrentUser()            → returns AuthenticatedUser | null
 * @CurrentUser('userId')    → returns string | null
 */
export const CurrentUser = createParamDecorator<
  /* 1st generic: the “data” you pass in */ keyof AuthenticatedUser | undefined,
  /* 2nd generic: what this decorator returns */ | AuthenticatedUser
  | AuthenticatedUser[keyof AuthenticatedUser]
  | null
>((property, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();

  const user = req.user as AuthenticatedUser | undefined;
  if (!user) return null;

  return property ? (user[property] ?? null) : user;
});
