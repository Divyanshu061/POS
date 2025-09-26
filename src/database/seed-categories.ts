// src/database/seed-categories.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Category } from '../inventory/category/entities/category.entity';
import { Company } from '../inventory/company/entities/company.entity';

export async function seed(ds = AppDataSource): Promise<void> {
  console.log('[seed-categories] starting seed...');
  await ds.initialize();
  console.log('[seed-categories] datasource initialized');

  const categoryRepo = ds.getRepository(Category);
  const companyRepo = ds.getRepository(Company);

  const envCompanyId = process.env.SEED_COMPANY_ID ?? '';

  let company: Company | null = null;

  if (envCompanyId) {
    company = await companyRepo.findOne({ where: { id: envCompanyId } });
    if (!company) {
      console.warn(
        `[seed-categories] no company found for SEED_COMPANY_ID: ${envCompanyId}`,
      );
    } else {
      console.log(
        `[seed-categories] using company from SEED_COMPANY_ID: ${company.id} (${company.name ?? 'no name'})`,
      );
    }
  }

  if (!company) {
    company = await companyRepo.createQueryBuilder('c').getOne();
    if (company) {
      console.log(
        `[seed-categories] using first existing company: ${company.id} (${company.name ?? 'no name'})`,
      );
    }
  }

  if (!company) {
    try {
      const created = companyRepo.create({ name: 'Default Company' });
      company = await companyRepo.save(created);
      console.log(
        `[seed-categories] created default company: ${company.id} (${company.name ?? 'no name'})`,
      );
    } catch (err) {
      console.error(
        '[seed-categories] failed to create default company. Aborting seeder.',
      );
      console.error(err);
      await ds.destroy();
      throw new Error(
        'No company available. Provide SEED_COMPANY_ID or create a company first.',
      );
    }
  }

  // capture id (company guaranteed non-null here)
  const companyId = company.id;

  try {
    const seedCats: Array<{ name: string; description?: string }> = [
      { name: 'Cables', description: 'Cabling and wiring' },
      { name: 'Pipes', description: 'PVC and metal pipes' },
      { name: 'Fittings', description: 'Pipe fittings and connectors' },
    ];

    for (const c of seedCats) {
      const exist = await categoryRepo.findOne({
        where: { name: c.name, companyId },
      });

      if (!exist) {
        // use companyId instead of relation object so typings are happy
        const toSave = categoryRepo.create({
          ...c,
          companyId,
        });
        await categoryRepo.save(toSave);
        console.log(`[seed-categories] Inserted ${toSave.name}`);
      } else {
        console.log(`[seed-categories] Using existing ${exist.name}`);
      }
    }

    console.log('[seed-categories] finished successfully');
  } finally {
    await ds.destroy();
    console.log('[seed-categories] datasource destroyed');
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed-categories] process exiting with 0');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed-categories] ERROR', err);
      if (AppDataSource.isInitialized) {
        AppDataSource.destroy().catch(() => {});
      }
      process.exit(1);
    });
}
