// src/database/seed-tags.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Tag } from '../crm/tag/entities/tag.entity';
import { Client } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';

async function seed() {
  await AppDataSource.initialize();

  const tagRepo = AppDataSource.getRepository(Tag);
  const clientRepo = AppDataSource.getRepository(Client);
  const userRepo = AppDataSource.getRepository(User);

  try {
    // need a company context — derive from an existing user if necessary
    const owner = (await userRepo.find({ take: 1 }))[0];
    if (!owner) {
      throw new Error('No users found — please seed users first.');
    }
    console.log('Using owner for context:', owner.id);

    // 1) Tags to ensure exist
    const seedTags = ['important', 'wholesale', 'priority', 'lead'];
    const createdTags: Tag[] = [];

    for (const name of seedTags) {
      let t = await tagRepo.findOne({ where: { name } });
      if (!t) {
        t = tagRepo.create({ name });
        await tagRepo.save(t);
        console.log('Created tag:', t.id, t.name);
      } else {
        console.log('Using existing tag:', t.id, t.name);
      }
      createdTags.push(t);
    }

    // 2) Attach tags to a sample of clients (idempotent)
    const clients = await clientRepo.find({
      where: {},
      take: 5,
      relations: ['tags'],
    });
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      // pick one or two tags
      const tagToAttach = createdTags[i % createdTags.length];
      // avoid duplicate attachments
      const has = (client.tags || []).some((tt) => tt.id === tagToAttach.id);
      if (!has) {
        client.tags = [...(client.tags || []), tagToAttach];
        await clientRepo.save(client);
        console.log(
          `Attached tag "${tagToAttach.name}" to client ${client.email}`,
        );
      } else {
        console.log(
          `Client ${client.email} already has tag "${tagToAttach.name}"`,
        );
      }
    }

    console.log('Tag seed complete');
  } catch (err) {
    console.error('Tag seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((e) => {
  console.error('Unhandled tag seed error', e);
  process.exit(1);
});
