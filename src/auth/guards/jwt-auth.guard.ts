// src/auth/guards/jwt-auth.guard.ts

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard
 * - Skips authentication for routes marked @Public()
 * - Throws UnauthorizedException on any auth failure
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Allows routes marked @Public() to bypass JWT auth.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context) as boolean;
  }

  /**
   * Handles the result of the authentication attempt.
   * Throws on error or missing user.
   */
  handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err) {
      throw new UnauthorizedException('Authentication error');
    }
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
