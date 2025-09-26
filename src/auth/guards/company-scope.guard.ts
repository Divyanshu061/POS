// src/auth/guards/company-scope.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

interface AuthenticatedUser {
  companyId?: string | null;
  roles?: string[];
}

/**
 * Use a local alias for Request with optional typed user.
 * We don't extend the global Request to avoid ambient type conflicts.
 */
type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class CompanyScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const reqWithUser = req as RequestWithUser;
    const user = reqWithUser.user ?? null;

    // If not authenticated, allow (JwtAuthGuard should reject unauthenticated requests).
    if (!user) return true;

    const userCompany: string | null = user.companyId ?? null;
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];

    // Allow platform super-admins
    if (roles.includes('super-admin')) return true;

    // === Safe, runtime narrowing of params/query/body ===
    // treat raw values as unknown first, then narrow and read.
    const rawParams: unknown = req.params;
    const rawQuery: unknown = req.query;
    const rawBody: unknown = req.body;

    let clientCompany: string | undefined;

    if (
      rawParams &&
      typeof rawParams === 'object' &&
      !Array.isArray(rawParams)
    ) {
      const paramsObj = rawParams as Record<string, unknown>;
      const v = paramsObj['companyId'];
      if (typeof v === 'string') clientCompany = v;
    }

    if (
      !clientCompany &&
      rawQuery &&
      typeof rawQuery === 'object' &&
      !Array.isArray(rawQuery)
    ) {
      const queryObj = rawQuery as Record<string, unknown>;
      const q = queryObj['companyId'];
      if (typeof q === 'string') clientCompany = q;
      // sometimes query params are arrays or numbers, the typeof check above handles strings only
    }

    if (
      !clientCompany &&
      rawBody &&
      typeof rawBody === 'object' &&
      !Array.isArray(rawBody)
    ) {
      const bodyObj = rawBody as Record<string, unknown>;
      const b = bodyObj['companyId'];
      if (typeof b === 'string') clientCompany = b;
    }

    // nothing supplied by client to validate
    if (!clientCompany) return true;

    // mismatch -> deny
    if (clientCompany !== userCompany) {
      throw new ForbiddenException('Access denied for this company');
    }

    return true;
  }
}
