// src/database/seed-clients.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';

export async function seed(ds = AppDataSource): Promise<void> {
  console.log('[seed-clients] starting seed...');
  await ds.initialize();
  console.log('[seed-clients] datasource initialized');

  const userRepo = ds.getRepository(User);
  const clientRepo = ds.getRepository(Client);
  const companyRepo = ds.getRepository(Company);

  const envOwnerId = process.env.SEED_OWNER_ID ?? '';
  const envCompanyId = process.env.SEED_COMPANY_ID ?? '';

  // resolve owner (env -> first existing)
  let owner: User | null = null;

  if (envOwnerId) {
    owner = await userRepo.findOne({ where: { id: envOwnerId } });
    if (!owner) {
      console.warn(
        `[seed-clients] no user found for SEED_OWNER_ID=${envOwnerId}`,
      );
    } else {
      console.log(
        `[seed-clients] using owner from SEED_OWNER_ID: ${owner.id} (${owner.email ?? 'no email'})`,
      );
    }
  }

  if (!owner) {
    owner = await userRepo.createQueryBuilder('u').getOne();
    if (!owner) {
      console.error(
        '[seed-clients] no users present. Seed users first or provide SEED_OWNER_ID.',
      );
      await ds.destroy();
      throw new Error('No users available for seeding clients.');
    }
    console.log(
      `[seed-clients] using first existing user: ${owner.id} (${owner.email ?? 'no email'})`,
    );
  }

  // resolve companyId (env -> owner.companyId -> first company -> create default)
  let companyId: string | undefined = envCompanyId || undefined;

  // owner.companyId is typed as string | null | undefined in your User entity,
  // so it's safe to read directly without any 'any' casts.
  if (!companyId && owner && owner.companyId) {
    companyId = owner.companyId;
    console.log(`[seed-clients] using owner's companyId: ${companyId}`);
  }

  if (!companyId) {
    const firstCompany = await companyRepo.createQueryBuilder('c').getOne();
    if (firstCompany) {
      companyId = firstCompany.id;
      console.log(
        `[seed-clients] using first existing company: ${companyId} (${firstCompany.name})`,
      );
    }
  }

  if (!companyId) {
    try {
      const created = companyRepo.create({ name: 'Default Company' });
      const saved = await companyRepo.save(created);
      companyId = saved.id;
      console.log(
        `[seed-clients] created default company: ${companyId} (${saved.name})`,
      );
    } catch (err) {
      console.error(
        '[seed-clients] failed to create default company. Aborting seeder.',
      );
      console.error(err);
      await ds.destroy();
      throw new Error(
        'No company available for seeding clients. Provide SEED_COMPANY_ID or create a company first.',
      );
    }
  }

  if (!companyId) {
    await ds.destroy();
    throw new Error('No companyId resolved. Aborting.');
  }

  const ownerId = owner.id;

  try {
    const seedClients: Array<
      Partial<Client> & { ownerId: string; companyId: string }
    > = [
      {
        name: 'Alice Johnson',
        title: 'CTO',
        email: 'alice@example.com',
        phone: '+91-9876543210',
        status: ClientStatus.ACTIVE,
        ownerId,
        companyId,
      },
      {
        name: 'Bob Singh',
        title: 'Manager',
        email: 'bob@example.com',
        phone: '+91-9123456780',
        status: ClientStatus.PROSPECT,
        ownerId,
        companyId,
      },
    ];

    for (const c of seedClients) {
      const whereClause: Record<string, unknown> = {
        email: c.email,
        ownerId: c.ownerId,
        companyId: c.companyId,
      };

      const exist = await clientRepo.findOne({ where: whereClause });

      if (!exist) {
        const toSave = clientRepo.create(c);
        const saved = await clientRepo.save(toSave);
        console.log(
          `[seed-clients] Inserted client: ${saved.id} (${saved.email})`,
        );
      } else {
        console.log(
          `[seed-clients] Using existing client: ${exist.id} (${exist.email})`,
        );
      }
    }

    console.log('[seed-clients] finished successfully');
  } catch (err) {
    console.error('[seed-clients] ERROR while seeding clients:', err);
    throw err;
  } finally {
    await ds.destroy();
    console.log('[seed-clients] datasource destroyed');
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed-clients] process exiting with 0');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed-clients] Unhandled error:', err);
      if (AppDataSource.isInitialized) {
        AppDataSource.destroy().catch(() => {});
      }
      process.exit(1);
    });
}
