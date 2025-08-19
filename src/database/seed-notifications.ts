// import 'reflect-metadata';
// import { AppDataSource } from './data-source';
// import { Notification } from '../inventory/notification/entities/notification.entity';

// export async function seed(ds = AppDataSource) {
//   await ds.initialize();
//   const repo = ds.getRepository(Notification);
//   try {
//     const examples = [
//       { title: 'Welcome', body: 'Welcome to Seed Co', level: 'info', companyId: '421e0488-aa80-4ade-ad90-2b458b7e4de8' },
//       { title: 'Low stock SF-1002', body: 'Product SF-1002 is low on stock', level: 'warning', companyId: '421e0488-aa80-4ade-ad90-2b458b7e4de8' },
//     ];
//     for (const n of examples) {
//       let found = await repo.findOne({ where: { title: n.title, companyId: n.companyId } });
//       if (!found) {
//         await repo.save(n);
//         console.log('[notifications] Created', n.title);
//       } else {
//         console.log('[notifications] Exists', n.title);
//       }
//     }
//   } finally {
//     await ds.destroy();
//   }
// }
