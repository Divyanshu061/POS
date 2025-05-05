// src/scripts/seed.ts

import * as dotenv from 'dotenv';
dotenv.config(); // load .env into process.env

import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

// debug—verify env‑vars are loaded correctly
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);

// configure a single DataSource instance
const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Role, Permission],
  synchronize: true, // in dev: auto‑create tables
  logging: false,
});

async function seed() {
  await ds.initialize();

  const permRepo = ds.getRepository(Permission);
  const roleRepo = ds.getRepository(Role);

  const permNames = [
    'inventory.create',
    'inventory.view',
    'inventory.update',
    'inventory.delete',
    'orders.view_assigned',
    'clients.view_assigned',
  ];

  // create permissions if missing
  const permissions = [];
  for (const name of permNames) {
    let perm = await permRepo.findOne({ where: { name } });
    if (!perm) {
      perm = permRepo.create({ name });
      await permRepo.save(perm);
      console.log(`➕ Created permission: ${name}`);
    }
    permissions.push(perm);
  }

  // define roles and which perms they get
  const rolesToSeed = [
    { name: 'admin', filter: () => true },
    {
      name: 'store_manager',
      filter: (p: Permission) => p.name.startsWith('inventory.'),
    },
    {
      name: 'sales_rep',
      filter: (p: Permission) =>
        p.name.startsWith('orders.') || p.name.startsWith('clients.'),
    },
  ];

  // create or update roles
  for (const { name, filter } of rolesToSeed) {
    let role = await roleRepo.findOne({
      where: { name },
      relations: ['permissions'],
    });
    const permsForRole = permissions.filter(filter);
    if (!role) {
      role = roleRepo.create({ name, permissions: permsForRole });
      await roleRepo.save(role);
      console.log(`➕ Created role: ${name}`);
    } else {
      role.permissions = permsForRole;
      await roleRepo.save(role);
      console.log(`🔄 Updated role: ${name}`);
    }
  }

  console.log('✅ Seed complete');
  await ds.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
