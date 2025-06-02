// scripts/alter-entity-id.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT!,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await ds.initialize();
  console.log('Altering audit_log.entity_id to varchar...');
  await ds.query(`
    ALTER TABLE audit_log
    ALTER COLUMN entity_Id TYPE varchar;
  `);
  console.log('Done.');
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
