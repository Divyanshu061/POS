// src/database/seed-users.ts
import { DataSource } from 'typeorm';
import { hash } from 'bcrypt';
import { AppDataSource } from './data-source';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity'; // adjust path if needed

async function seedUsers() {
  const ds: DataSource = AppDataSource;
  await ds.initialize();

  const userRepo = ds.getRepository(User);
  const roleRepo = ds.getRepository(Role);

  // Seed roles if not present
  const roles = ['admin', 'store_manager', 'warehouse_staff', 'sales_rep'];
  for (const roleName of roles) {
    let role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      role = roleRepo.create({ name: roleName });
      await roleRepo.save(role);
      console.log(`Seeded role: ${roleName}`);
    }
  }

  // Seed admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await userRepo.findOne({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin user already exists:', adminEmail);
  } else {
    const passwordHash = await hash(adminPassword, 10);
    const adminUser = userRepo.create({
      name: 'Administrator',
      email: adminEmail,
      password: passwordHash, // make sure your User entity has a `password` column
      isActive: true,
      roles: [await roleRepo.findOneOrFail({ where: { name: 'admin' } })],
    });
    await userRepo.save(adminUser);
    console.log('Seeded admin user:', adminEmail);
  }

  await ds.destroy();
}

seedUsers().catch((err) => {
  console.error('Error seeding users:', err);
  process.exit(1);
});
