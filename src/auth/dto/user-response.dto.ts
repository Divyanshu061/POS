// src/auth/dto/user-response.dto.ts

import { User } from '../../entities/user.entity';

export class UserResponseDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly isActive: boolean;
  /** Only expose role IDs & names, not the full entity */
  readonly roles: Array<{ id: string; name: string }>;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.isActive = user.isActive;
    this.roles = user.roles.map((r) => ({ id: r.id, name: r.name }));
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
