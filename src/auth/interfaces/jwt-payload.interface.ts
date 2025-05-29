// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // User UUID
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}
