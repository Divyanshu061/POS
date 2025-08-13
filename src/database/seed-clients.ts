// src/database/seed-clients.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';

async function seed() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const clientRepo = AppDataSource.getRepository(Client);

  try {
    // 1) Pick an existing user (owner) or fail
    const owners = await userRepo.find({ take: 1 }); // safe way to get one user
    const owner = owners[0];
    if (!owner) {
      throw new Error('No users found — please seed users first.');
    }
    console.log('Using owner:', owner.id, owner.email);

    // 2) Seed clients
    const seedClients = [
      {
        name: 'Alice Johnson',
        company: 'TechNova Ltd',
        title: 'CTO',
        email: 'alice@example.com',
        phone: '+91-9876543210',
        status: ClientStatus.ACTIVE,
        ownerId: owner.id,
      },
      {
        name: 'Bob Singh',
        company: 'GreenLeaf Agro',
        title: 'Manager',
        email: 'bob@example.com',
        phone: '+91-9123456780',
        status: ClientStatus.PROSPECT,
        ownerId: owner.id,
      },
    ];

    for (const c of seedClients) {
      let existing = await clientRepo.findOne({
        where: { email: c.email, ownerId: c.ownerId },
      });
      if (!existing) {
        existing = await clientRepo.save(c);
        console.log('Inserted client:', existing.id, existing.email);
      } else {
        console.log('Using existing client:', existing.id, existing.email);
      }
    }

    console.log('Client seed complete');
  } catch (err) {
    console.error('Client seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((e) => {
  console.error('Unhandled client seed error', e);
  process.exit(1);
});
