// src/roles/dto/create-role.dto.ts
export class CreateRoleDto {
  readonly name!: string; // Role name
  readonly permissionIds!: string[]; // Array of Permission UUIDs to attach
}
