// scripts/seed.ts

import * as dotenv from 'dotenv';
dotenv.config(); // load .env into process.env

import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { Category } from '../inventory/category/entities/category.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Company } from '../inventory/company/entities/company.entity';

async function main() {
  // 1) Configure DataSource
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    entities: [Role, Permission, Company, Category, Warehouse, Supplier],
    synchronize: true, // only in dev
    logging: false,
  });

  await ds.initialize();
  console.log('🔗 Database connected for seeding.');

  // 2) Seed Permissions
  const permRepo = ds.getRepository(Permission);
  const permNames = [
    'inventory.create',
    'inventory.view',
    'inventory.update',
    'inventory.delete',
    'orders.view_assigned',
    'clients.view_assigned',
  ];
  const permissions = [];
  for (const name of permNames) {
    let p = await permRepo.findOne({ where: { name } });
    if (!p) {
      p = permRepo.create({ name });
      await permRepo.save(p);
      console.log(`➕ Created permission: ${name}`);
    }
    permissions.push(p);
  }

  // 3) Seed Roles
  const roleRepo = ds.getRepository(Role);
  const rolesToSeed = [
    { name: 'admin', filter: () => true },
    {
      name: 'store_manager',
      filter: (p: Permission) => p.name.startsWith('inventory.'),
    },
    {
      name: 'warehouse_staff',
      filter: (p: Permission) => p.name.startsWith('inventory.'),
    },
    {
      name: 'sales_rep',
      filter: (p: Permission) =>
        p.name.startsWith('orders.') || p.name.startsWith('clients.'),
    },
  ];
  for (const { name, filter } of rolesToSeed) {
    let r = await roleRepo.findOne({
      where: { name },
      relations: ['permissions'],
    });
    const perms = permissions.filter(filter);
    if (!r) {
      r = roleRepo.create({ name, permissions: perms });
      await roleRepo.save(r);
      console.log(`➕ Created role: ${name}`);
    } else {
      r.permissions = perms;
      await roleRepo.save(r);
      console.log(`🔄 Updated role: ${name}`);
    }
  }

  // 4) Seed Inventory: Categories
  const categoryRepo = ds.getRepository(Category);
  const defaultCompanyId = '11111111-1111-1111-1111-111111111111'; // replace as needed
  const cats = [
    { name: 'Raw Materials', parent: null },
    { name: 'Finished Goods', parent: null },
  ];
  for (const { name, parent } of cats) {
    let c = await categoryRepo.findOne({
      where: { name, companyId: defaultCompanyId },
    });
    if (!c) {
      c = categoryRepo.create({
        name,
        companyId: defaultCompanyId,
        parent: parent ? { id: parent } : undefined,
      });
      await categoryRepo.save(c);
      console.log(`➕ Created category: ${name}`);
    }
  }

  // 5) Seed Inventory: Warehouses
  const warehouseRepo = ds.getRepository(Warehouse);
  const whs = [
    { name: 'Main Warehouse', address: '123 Main St' },
    { name: 'Secondary Warehouse', address: '456 Side Ave' },
  ];
  for (const { name, address } of whs) {
    let w = await warehouseRepo.findOne({
      where: { name, companyId: defaultCompanyId },
    });
    if (!w) {
      w = warehouseRepo.create({ name, address, companyId: defaultCompanyId });
      await warehouseRepo.save(w);
      console.log(`➕ Created warehouse: ${name}`);
    }
  }

  // 6) Seed Inventory: Suppliers
  const supplierRepo = ds.getRepository(Supplier);
  const sups = [
    { name: 'Acme Corp.', contactInfo: 'sales@acme.local' },
    { name: 'Global Supplies', contactInfo: 'info@global.sup' },
  ];
  for (const { name, contactInfo } of sups) {
    let s = await supplierRepo.findOne({
      where: { name, companyId: defaultCompanyId },
    });
    if (!s) {
      s = supplierRepo.create({
        name,
        contactInfo,
        companyId: defaultCompanyId,
      });
      await supplierRepo.save(s);
      console.log(`➕ Created supplier: ${name}`);
    }
  }

  console.log('✅ All seeding complete.');
  await ds.destroy();
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
