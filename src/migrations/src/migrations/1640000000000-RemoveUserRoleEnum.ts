import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUserRoleEnum1640000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Drop the role column
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN IF EXISTS "role";
    `);

    // 2) Drop the enum type left behind
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'user_role'
        ) THEN
          DROP TYPE "user_role";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1) Re-create the enum type
    await queryRunner.query(`
      CREATE TYPE "user_role" AS ENUM (
        'admin',
        'store_manager',
        'sales_rep'
      );
    `);

    // 2) Re-add the column
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "role" "user_role";
    `);
  }
}
