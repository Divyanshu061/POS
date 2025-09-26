// src/database/seed-users.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { hash } from 'bcrypt';
import { AppDataSource } from './data-source';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Company } from '../inventory/company/entities/company.entity';

async function seedUsers() {
  const ds: DataSource = AppDataSource;
  if (!ds.isInitialized) await ds.initialize();

  const queryRunner = ds.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const roleRepo = queryRunner.manager.getRepository(Role);
    const userRepo = queryRunner.manager.getRepository(User);
    const companyRepo = queryRunner.manager.getRepository(Company);

    // CONFIG / defaults (override with env vars)
    const roleNames = (
      process.env.SEED_ROLES || 'admin,store_manager,warehouse_staff,sales_rep'
    )
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const adminName = process.env.ADMIN_NAME || 'Administrator';
    const defaultCompanyName = process.env.COMPANY_NAME || 'Default Company';

    // Ensure a company exists to attach seeded users (optional)
    let company = await companyRepo.findOne({
      where: { name: defaultCompanyName },
    });
    if (!company) {
      company = companyRepo.create({
        name: defaultCompanyName,
      } as Partial<Company>);
      company = await companyRepo.save(company);
      console.log('Created default company:', company.id);
    } else {
      console.log('Using existing company:', company.id);
    }

    // 1) Seed roles (idempotent)
    const savedRoles: Role[] = [];
    for (const name of roleNames) {
      let role = await roleRepo.findOne({ where: { name } });
      if (!role) {
        role = roleRepo.create({ name } as Partial<Role>);
        role = await roleRepo.save(role);
        console.log(`Seeded role: ${name}`);
      } else {
        console.log(`Role exists: ${name}`);
      }
      savedRoles.push(role);
    }

    // 2) Ensure admin role exists (we will attach it to admin user)
    const adminRole =
      savedRoles.find((r) => r.name === 'admin') ??
      (await roleRepo.findOne({ where: { name: 'admin' } }));
    if (!adminRole) {
      throw new Error('Admin role not found after seeding roles. Aborting.');
    }

    // 3) Create or update admin user (idempotent)
    let admin = await userRepo.findOne({
      where: { email: adminEmail },
      relations: ['roles'],
    });

    if (!admin) {
      // Hash the password unless it already looks hashed
      const looksHashed =
        adminPassword.startsWith('$2a$') ||
        adminPassword.startsWith('$2b$') ||
        adminPassword.startsWith('$2y$');
      const passwordToStore = looksHashed
        ? adminPassword
        : await hash(adminPassword, 10);

      admin = userRepo.create({
        name: adminName,
        email: adminEmail,
        password: passwordToStore,
        isActive: true,
        company: company,
        companyId: company.id,
        roles: [adminRole],
      } as Partial<User>);

      admin = await userRepo.save(admin);
      console.log('Created admin user:', adminEmail);
    } else {
      // ensure admin has admin role
      const hasAdminRole = (admin.roles || []).some((r) => r.name === 'admin');
      if (!hasAdminRole) {
        admin.roles = [...(admin.roles || []), adminRole];
        await userRepo.save(admin);
        console.log('Added admin role to existing user:', adminEmail);
      } else {
        console.log('Admin user already exists with admin role:', adminEmail);
      }
    }

    await queryRunner.commitTransaction();
    console.log('✅ seed-users completed');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('seed-users failed:', err);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

seedUsers().catch((e) => {
  console.error('Unhandled error in seed-users:', e);
  process.exit(1);
});
