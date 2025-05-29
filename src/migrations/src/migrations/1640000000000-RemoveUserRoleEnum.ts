import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUserRoleEnum1640000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the 'role' column if it exists
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "role";
    `);

    // Drop the enum type 'user_role' only if it exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'user_role'
        ) THEN
          DROP TYPE "user_role";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the 'user_role' enum type
    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM (
        'admin',
        'store_manager',
        'sales_rep'
      );
    `);

    // Re-add the 'role' column using the recreated enum
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "role" "user_role";
    `);
  }
}
