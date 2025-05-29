// src/auth/decorators/company.decorator.ts

import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';

interface JwtUser {
  companyId: string;
  // ...other JWT claims
}

export const Company = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    // Tell TS exactly what shape getRequest() returns
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();

    // 1) Try the authenticated user’s payload first
    const fromUser = request.user?.companyId;

    // 2) Fallback to query param
    const fromQuery =
      typeof request.query.companyId === 'string'
        ? request.query.companyId
        : undefined;

    const companyId = fromUser ?? fromQuery;
    if (!companyId) {
      throw new BadRequestException('Missing required companyId');
    }
    return companyId;
  },
);
