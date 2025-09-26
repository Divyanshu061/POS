// src/auth/guards/tenant.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type JwtRole = string | { name?: string | null };
type JwtUser = {
  companyId?: string | null;
  companies?: string[];
  roles?: JwtRole[];
  permissions?: string[];
  userId?: string;
};

function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  const uuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return uuidRe.test(value);
}

/**
 * Safely extract/normalize role input (string or object with name).
 * Returns empty string for unknown shapes.
 */
function normalizeRoleRaw(raw: unknown): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    return raw.toLowerCase().replace(/[\W_]+/g, '');
  }
  if (typeof raw === 'object' && raw !== null) {
    const maybeName = (raw as Record<string, unknown>)['name'];
    if (typeof maybeName === 'string') {
      return maybeName.toLowerCase().replace(/[\W_]+/g, '');
    }
  }
  return '';
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Respect @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = ctx
      .switchToHttp()
      .getRequest<
        Request & { user?: JwtUser; currentCompanyId?: string | null }
      >();

    // If no Authorization header is present, treat as unauthenticated and allow.
    // This avoids rejecting public signup before JwtAuthGuard runs.
    // (If you want stricter behavior remove this and rely on isPublic only.)
    const hasAuthHeader =
      !!req.headers &&
      !!(req.headers['authorization'] || req.headers['Authorization']);
    if (!hasAuthHeader) {
      return true;
    }

    const user = req.user;

    // parse optional header override
    const rawHeader = req.headers['x-company-id'];
    let headerCompany: string | undefined;
    if (typeof rawHeader === 'string') {
      headerCompany = rawHeader.trim();
    } else if (Array.isArray(rawHeader) && rawHeader.length) {
      headerCompany = String(rawHeader[0]).trim();
    }

    // detect superadmin role safely
    const isSuper = (() => {
      if (!user?.roles) return false;
      return (user.roles || []).some(
        (r) => normalizeRoleRaw(r) === 'superadmin',
      );
    })();

    const hasManageAll = (() => {
      if (!user?.permissions) return false;
      return (user.permissions || []).some(
        (p) => String(p).toLowerCase() === 'manage_all',
      );
    })();

    // If header provided — attempt to use it (with validation + membership checks)
    if (headerCompany) {
      if (!isUuid(headerCompany)) {
        throw new BadRequestException(
          'x-company-id header is not a valid UUID',
        );
      }

      // allow header for superadmins / manage_all
      if (isSuper || hasManageAll) {
        req.currentCompanyId = headerCompany;
        return true;
      }

      // multi-company membership check
      if (user?.companies && Array.isArray(user.companies)) {
        if (!user.companies.includes(headerCompany)) {
          throw new ForbiddenException(
            'You do not have access to the requested company (x-company-id).',
          );
        }
        req.currentCompanyId = headerCompany;
        return true;
      }

      // single-company user must match header
      if (user?.companyId && user.companyId === headerCompany) {
        req.currentCompanyId = headerCompany;
        return true;
      }

      throw new ForbiddenException(
        'Header x-company-id provided but user not allowed for that company.',
      );
    }

    // No header: fall back to token/company on user
    const tokenCompany = user?.companyId ?? null;

    if (tokenCompany) {
      if (!isUuid(tokenCompany)) {
        throw new BadRequestException('Authenticated companyId is invalid');
      }
      req.currentCompanyId = tokenCompany;
      return true;
    }

    // No token company present: allow superadmins/manage_all to proceed with null company
    if (user && (isSuper || hasManageAll)) {
      req.currentCompanyId = null;
      return true;
    }

    // Otherwise reject - non-super user without a company is not allowed
    throw new BadRequestException(
      'Missing required companyId on authenticated user. Provide a company in your token or use x-company-id (admin only).',
    );
  }
}
