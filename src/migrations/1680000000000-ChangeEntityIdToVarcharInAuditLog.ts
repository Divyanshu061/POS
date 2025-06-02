import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeEntityIdToVarcharInAuditLog1680000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_log"
      ALTER COLUMN "entity_id" TYPE varchar;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_log"
      ALTER COLUMN "entity_id" TYPE uuid USING "entity_id"::uuid;
    `);
  }
}
