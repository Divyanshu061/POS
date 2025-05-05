// src/auth/interfaces/authenticated-user.interface.ts
export interface AuthenticatedUser {
  userId: string;
  id: string;
  email: string;
  roles: string[];
  // Add more fields if needed
}
