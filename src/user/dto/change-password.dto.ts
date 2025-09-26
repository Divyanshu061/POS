import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /**
   * Required when the caller is changing their own password.
   * Admins may omit this when performing a reset.
   */
  @IsOptional()
  @IsString()
  @MinLength(6)
  currentPassword?: string;

  /** New plaintext password */
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
