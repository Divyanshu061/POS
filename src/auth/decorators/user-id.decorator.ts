// src/auth/decorators/user-id.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Interface representing how your JWT strategy populates `request.user`.
 * `mapToAuthenticatedUser()` sets both `userId` and `id` to the same UUID.
 */
interface AuthenticatedUser {
  userId: string;
  id: string;
  email: string;
  roles: string[];
}

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || typeof user.userId !== 'string') {
      return null;
    }
    return user.userId;
  },
);
