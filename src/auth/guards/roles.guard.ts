// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../enum/user-role.enum';

/** Minimal shape we expect on request.user */
interface AuthenticatedUser {
  userId: string;
  id?: string;
  email?: string;
  // roles may be strings or objects like { id, name }
  roles?: Array<string | { id?: string; name?: string }>;
  permissions?: string[];
  companyId?: string | null;
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  private normalizeRole(raw: unknown): string {
    // Prefer explicit checks instead of `any` to satisfy ESLint.
    let roleString: string | undefined;

    if (typeof raw === 'string') {
      roleString = raw;
    } else if (raw && typeof raw === 'object') {
      // safe access: treat as a record and check that 'name' exists and is a string
      const maybeName = (raw as Record<string, unknown>)['name'];
      if (typeof maybeName === 'string') {
        roleString = maybeName;
      }
    }

    if (!roleString) return '';

    return String(roleString)
      .toLowerCase()
      .replace(/[\W_]+/g, '');
  }

  canActivate(context: ExecutionContext): boolean {
    // read metadata from handler or class
    const requiredRoles =
      this.reflector.get<string[]>('roles', context.getHandler()) ??
      this.reflector.get<string[]>('roles', context.getClass());

    if (!requiredRoles || requiredRoles.length === 0) {
      // no specific roles required => allow
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      this.logger.warn('Request.user is missing; denying access.');
      return false;
    }

    // normalize user roles into simple strings
    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r) => this.normalizeRole(r)).filter(Boolean)
      : [];

    // normalize permissions if present
    const userPerms: string[] = Array.isArray(user.permissions)
      ? user.permissions.map((p) => String(p).toLowerCase())
      : [];

    // normalize required roles for comparison
    const normalizedRequired = requiredRoles
      .map((r) => this.normalizeRole(r))
      .filter(Boolean);

    this.logger.debug(
      `RolesGuard user=${user.userId} roles=[${userRoles.join(
        ',',
      )}] required=[${normalizedRequired.join(',')}]`,
    );

    // superadmin bypass (use canonical enum value normalized)
    const canonicalSuper = this.normalizeRole(UserRole.SUPER_ADMIN);
    if (userRoles.includes(canonicalSuper)) {
      this.logger.debug(`User ${user.userId} allowed by superadmin role`);
      return true;
    }

    // global permission bypass (optional)
    if (userPerms.includes('manage_all')) {
      this.logger.debug(`User ${user.userId} allowed by manage_all permission`);
      return true;
    }

    // require at least one matching role (exact match on normalized names)
    const allowed = normalizedRequired.some((r) => userRoles.includes(r));
    if (!allowed) {
      this.logger.warn(
        `Access denied: user=${user.userId} roles=[${userRoles.join(
          ',',
        )}] required=[${normalizedRequired.join(',')}]`,
      );
    }

    return allowed;
  }
}
