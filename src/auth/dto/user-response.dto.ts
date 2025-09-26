// src/auth/dto/user-response.dto.ts
import { User } from '../../entities/user.entity';
import { Company } from '../../inventory/company/entities/company.entity';

export class UserResponseDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly isActive: boolean;

  // allow null because User.companyId/user.company may be null in your entity
  readonly companyId?: string | null;
  readonly company?: Company | null;

  /** Only expose role IDs & names, not the full entity */
  readonly roles: Array<{ id: string; name: string }>;

  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.isActive = user.isActive;

    this.companyId = user.companyId ?? null;
    this.company = user.company ?? null;

    // Defensive: roles may be undefined/null
    this.roles = Array.isArray(user.roles)
      ? user.roles.map((r) => ({
          id: r?.id ?? '',
          name: r?.name ?? '',
        }))
      : [];

    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
