// src/auth/decorators/current-company.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Request shape expected from TenantGuard.
 * currentCompanyId may be string or null (for superadmins).
 */
type ReqWithCompany = Request & { currentCompanyId?: string | null };

/**
 * CurrentCompany (required)
 * - Returns string
 * - Throws BadRequestException if no company resolved (preserves previous behaviour)
 */
export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<ReqWithCompany>();
    const companyId = req.currentCompanyId ?? null;
    if (!companyId) {
      throw new BadRequestException(
        'Company not resolved on request. Ensure TenantGuard is applied.',
      );
    }
    return companyId;
  },
);

/**
 * CurrentCompanyOptional
 * - Returns string | null
 * - Does NOT throw; safe to use where a null company means "global/system"
 */
export const CurrentCompanyOptional = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<ReqWithCompany>();
    return req.currentCompanyId ?? null;
  },
);
