// src/database/seed-superadmin.ts
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source'; // adjust path if needed
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';

async function seed() {
  const ADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? 'superadmin@example.com';
  const ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe123!';
  const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Default Company';
  const ROLE_NAME = 'superadmin';
  const PERM_NAMES = [
    'manage_users',
    'manage_roles',
    'manage_permissions',
    'manage_all',
  ];

  // initialize data source
  const ds: DataSource = AppDataSource;
  if (!ds.isInitialized) await ds.initialize();

  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const companyRepo = queryRunner.manager.getRepository(Company);
    const roleRepo = queryRunner.manager.getRepository(Role);
    const permRepo = queryRunner.manager.getRepository(Permission);
    const userRepo = queryRunner.manager.getRepository(User);

    // 1) find or create company
    let company = await companyRepo.findOne({ where: { name: COMPANY_NAME } });
    if (!company) {
      company = companyRepo.create({ name: COMPANY_NAME } as Partial<Company>);
      company = await companyRepo.save(company);
      console.log('Created company:', company.id);
    } else {
      console.log('Using existing company:', company.id);
    }

    // 2) create/find permissions
    const savedPerms: Permission[] = [];
    for (const name of PERM_NAMES) {
      let p = await permRepo.findOne({ where: { name } });
      if (!p) {
        p = permRepo.create({ name } as Partial<Permission>);
        p = await permRepo.save(p);
        console.log('Created permission:', p.name);
      }
      savedPerms.push(p);
    }

    // 3) create or update role
    let role = await roleRepo.findOne({
      where: { name: ROLE_NAME },
      relations: ['permissions'],
    });
    if (!role) {
      role = roleRepo.create({ name: ROLE_NAME } as Partial<Role>);
      role.permissions = savedPerms;
      role = await roleRepo.save(role);
      console.log('Created role:', ROLE_NAME);
    } else {
      // sync permissions
      role.permissions = savedPerms;
      await roleRepo.save(role);
      console.log('Updated role permissions for:', ROLE_NAME);
    }

    // 4) create or update user (hash password to be safe)
    let user = await userRepo.findOne({
      where: { email: ADMIN_EMAIL },
      relations: ['roles'],
    });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, salt);

      user = userRepo.create({
        name: 'Super Admin',
        email: ADMIN_EMAIL,
        password: hashed,
        isActive: true,
        company: null,
        companyId: null,
        roles: [role],
      } as Partial<User>);

      user = await userRepo.save(user);
      console.log('Created superadmin user:', ADMIN_EMAIL);
    } else {
      // ensure role assigned
      const has = (user.roles || []).some((r) => r.name === ROLE_NAME);
      if (!has) {
        user.roles = [...(user.roles || []), role];
        await userRepo.save(user);
        console.log('Assigned superadmin role to existing user:', ADMIN_EMAIL);
      } else {
        console.log('User already has superadmin role:', ADMIN_EMAIL);
      }
    }

    await queryRunner.commitTransaction();
    console.log('✅ Superadmin seed completed (email: %s)', ADMIN_EMAIL);
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Superadmin seed failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

seed().catch((e) => {
  console.error('Seed script error:', e);
  process.exit(1);
});
