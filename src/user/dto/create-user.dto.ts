// src/user/dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  MinLength,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a user.
 * - companyId is required (and must be a UUID) for non-superadmin users.
 * - companyId is optional when roleNames includes 'superadmin'.
 */
export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user', example: 'Jane Doe' })
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Unique email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Password (min length 6)',
    minLength: 6,
    example: 'strongPassword123',
  })
  @IsString()
  @MinLength(6)
  password!: string;

  // ---------------------------------------------
  // companyId: UUID required for regular users,
  // optional when creating a SuperAdmin (via roleNames).
  // ---------------------------------------------
  @ApiPropertyOptional({
    description: 'ID of the company this user belongs to (UUID v4)',
    example: '2130ec65-a958-438e-ac37-a716a731ce09',
  })
  @ValidateIf((o: CreateUserDto) => {
    const roles = Array.isArray(o.roleNames) ? o.roleNames : [];
    // Normalize and check for 'superadmin'
    return !roles.some(
      (r) =>
        String(r)
          .toLowerCase()
          .replace(/[\W_]+/g, '') === 'superadmin',
    );
  })
  @IsUUID('4', { message: 'companyId must be a UUID' })
  @IsOptional()
  companyId?: string;

  // ---------------------------------------------
  // Role assignment by IDs (UUID v4)
  // ---------------------------------------------
  @ApiPropertyOptional({
    description: 'Assign roles at signup by their UUIDs',
    type: [String],
    example: ['11111111-2222-3333-4444-555555555555'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  // ---------------------------------------------
  // Role assignment by names (strings)
  // ---------------------------------------------
  @ApiPropertyOptional({
    description: 'Assign roles at signup by their names (case-insensitive)',
    type: [String],
    example: ['superadmin', 'admin'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleNames?: string[];
}
