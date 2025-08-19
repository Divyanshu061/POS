import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Category } from '../inventory/category/entities/category.entity';

export async function seed(ds = AppDataSource) {
  await ds.initialize();
  const repo = ds.getRepository(Category);
  try {
    const seedCats = [
      { name: 'Cables', description: 'Cabling and wiring' },
      { name: 'Pipes', description: 'PVC and metal pipes' },
      { name: 'Fittings', description: 'Pipe fittings and connectors' },
    ];
    for (const c of seedCats) {
      let exist = await repo.findOne({ where: { name: c.name } });
      if (!exist) {
        exist = repo.create(c);
        await repo.save(exist);
        console.log('[categories] Inserted', exist.name);
      } else {
        console.log('[categories] Using existing', exist.name);
      }
    }
  } finally {
    await ds.destroy();
  }
}
