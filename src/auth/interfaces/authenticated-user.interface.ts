// src/auth/interfaces/authenticated-user.interface.ts
export interface AuthenticatedUser {
  userId: string;
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
  companyId?: string | null;
  tokenVersion?: number;
  // Add more fields if needed
}
