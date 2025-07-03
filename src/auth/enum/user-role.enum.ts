// src/auth/user-role.enum.ts

/**
 * Defines application user roles for RBAC guards and decorators,
 * matching the names stored in the database.
 */
export enum UserRole {
  SALES_REP = 'sales_rep',
  STORE_MANAGER = 'store_manager',
  ADMIN = 'admin',
  // add more roles exactly as they appear in the `roles` table
}
