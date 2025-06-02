// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // User UUID (always present)
  id?: string; // ← add this so that `payload.id = userId` is allowed
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}
