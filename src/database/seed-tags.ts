import 'reflect-metadata';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from './data-source';
import { Tag } from '../crm/tag/entities/tag.entity';
import { Client } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';

/**
 * Lightweight idempotent tag seeder.
 * - prefers SEED_OWNER_ID or SEED_COMPANY_ID when provided
 * - creates tags if missing
 * - attaches tags to up to `maxAttach` clients for that company
 */
export async function seedTags(ds: DataSource = AppDataSource): Promise<void> {
  let mustDestroy = false;
  try {
    if (!ds.isInitialized) {
      await ds.initialize();
      mustDestroy = true;
    }

    const userRepo = ds.getRepository(User);
    const tagRepo = ds.getRepository(Tag);
    const clientRepo = ds.getRepository(Client);
    const companyRepo = ds.getRepository(Company);

    const envOwnerId = process.env.SEED_OWNER_ID ?? '';
    const envCompanyId = process.env.SEED_COMPANY_ID ?? '';
    const maxAttach = Number(process.env.SEED_TAG_ATTACH_MAX ?? '5');
    const seedTagString =
      process.env.SEED_TAGS ?? 'important,wholesale,priority,lead';
    const seedTags = seedTagString
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Resolve owner (optional)
    let owner: User | null = null;
    if (envOwnerId) {
      owner = await userRepo.findOne({ where: { id: envOwnerId } });
      if (owner)
        console.log(
          `[seed-tags] using owner from env: ${owner.id} (${owner.email})`,
        );
      else
        console.warn(
          `[seed-tags] no user found for SEED_OWNER_ID=${envOwnerId}`,
        );
    }

    // If owner not provided, pick the first existing user
    if (!owner) {
      owner = await userRepo.createQueryBuilder('u').getOne();
      if (!owner) throw new Error('No users found — please seed users first.');
      console.log(
        `[seed-tags] using first existing user: ${owner.id} (${owner.email ?? 'no email'})`,
      );
    }

    // Resolve company context (owner -> env -> first company)
    let company: Company | null = null;
    if (envCompanyId) {
      company = await companyRepo.findOne({ where: { id: envCompanyId } });
      if (company)
        console.log(
          `[seed-tags] using company from env: ${company.id} (${company.name})`,
        );
      else
        console.warn(
          `[seed-tags] no company for SEED_COMPANY_ID=${envCompanyId}`,
        );
    }

    if (!company && owner?.companyId) {
      company = await companyRepo.findOne({ where: { id: owner.companyId } });
      if (company)
        console.log(
          `[seed-tags] using owner's company: ${company.id} (${company.name})`,
        );
    }

    if (!company) {
      company = await companyRepo.createQueryBuilder('c').getOne();
      if (!company) throw new Error('No company found. Seed a company first.');
      console.log(
        `[seed-tags] using first existing company: ${company.id} (${company.name})`,
      );
    }

    // 1) Ensure tags exist (company-scoped optional)
    const createdTags: Tag[] = [];
    for (const name of seedTags) {
      // typed where clause
      const where: FindOptionsWhere<Tag> = { name };

      // augment the where with companyId if applicable
      if (company?.id) {
        // Narrow the type just for assignment (this is safe and keeps FindOptionsWhere<Tag>)
        (where as FindOptionsWhere<Tag> & { companyId?: string }).companyId =
          company.id;
      }

      let t = await tagRepo.findOne({ where });
      if (!t) {
        t = tagRepo.create({
          name,
          company,
          companyId: company.id,
        });
        await tagRepo.save(t);
        console.log(`[seed-tags] Created tag: ${t.id} ${t.name}`);
      } else {
        console.log(`[seed-tags] Using existing tag: ${t.id} ${t.name}`);
      }
      createdTags.push(t);
    }

    // 2) Attach tags to a sample of clients in this company (idempotent)
    const clients = await clientRepo.find({
      where: { companyId: company.id },
      take: maxAttach,
      relations: ['tags'],
    });

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];

      // choose one or two tags to attach deterministically (idempotent)
      const primary = createdTags[i % createdTags.length];
      const secondary = createdTags[(i + 1) % createdTags.length];
      const toAttach = [primary, ...(i % 2 === 0 ? [secondary] : [])];

      const existingTagIds = new Set((client.tags || []).map((tt) => tt.id));
      const newTags = toAttach.filter((t) => !existingTagIds.has(t.id));
      if (newTags.length === 0) {
        console.log(`[seed-tags] client ${client.email} already has tags`);
        continue;
      }

      client.tags = [...(client.tags || []), ...newTags];
      await clientRepo.save(client);
      console.log(
        `[seed-tags] attached ${newTags.map((t) => t.name).join(', ')} to ${client.email}`,
      );
    }

    console.log('[seed-tags] Tag seeding completed');
  } catch (rawErr) {
    const errMessage =
      rawErr instanceof Error
        ? (rawErr.stack ?? rawErr.message)
        : String(rawErr);
    console.error('[seed-tags] failed:', errMessage);
    process.exitCode = 1;
  } finally {
    try {
      if (mustDestroy && ds.isInitialized) await ds.destroy();
    } catch (destroyErr) {
      console.warn('[seed-tags] error destroying datasource:', destroyErr);
    }
  }
}

// Run directly
if (require.main === module) {
  seedTags()
    .then(() => {
      console.log('[seed-tags] process exiting with 0');
      process.exit(0);
    })
    .catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[seed-tags] unhandled error:', msg);
      process.exit(1);
    });
}
