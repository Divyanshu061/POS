// // src/database/seed-purchase-orders.ts
// import 'reflect-metadata';
// import { AppDataSource } from './data-source';
// import { DataSource, Repository } from 'typeorm';
// import { Company } from '../inventory/company/entities/company.entity';
// import { Supplier } from '../inventory/supplier/entities/supplier.entity';
// import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
// import { User } from '../entities/user.entity';
// import { Product } from '../inventory/product/entities/product.entity';
// import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
// import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
// import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';
// import { PurchaseOrderStatus } from '../purchase-order/enums/purchase-order-status.enum';

// /**
//  * Short human-friendly suffix used to create company-specific SKU variants.
//  */
// function shortCompanySuffix(companyId: string, companyName?: string) {
//   if (companyName) {
//     const token = companyName
//       .split(/\s+/)[0]
//       .replace(/[^A-Za-z0-9]/g, '')
//       .toUpperCase();
//     if (token.length > 0 && token.length <= 8) return token;
//   }
//   return companyId.replace(/-/g, '').slice(0, 8);
// }

// /**
//  * The main seed function. Idempotent and company-aware.
//  */
// export async function seed(ds: DataSource = AppDataSource): Promise<void> {
//   let mustDestroy = false;
//   try {
//     if (!ds.isInitialized) {
//       await ds.initialize();
//       mustDestroy = true;
//     }

//     const companyRepo = ds.getRepository(Company);
//     const supplierRepo = ds.getRepository(Supplier);
//     const warehouseRepo = ds.getRepository(Warehouse);
//     const userRepo = ds.getRepository(User);

//     // pick a company to seed into (prefer "Seed Co")
//     let company = await companyRepo.findOne({ where: { name: 'Seed Co' } });
//     if (!company) {
//       const companies = await companyRepo.find({ take: 1 });
//       company = companies[0];
//     }
//     if (!company) throw new Error('No company found. Seed a company first.');

//     const companyId = company.id;
//     const companyName = company.name;

//     // ensure supplier for this company
//     let supplier = await supplierRepo.findOne({
//       where: { name: 'Sunrise Distributors', companyId },
//     });
//     if (!supplier) {
//       supplier = supplierRepo.create({
//         name: 'Sunrise Distributors',
//         companyId,
//       } as Partial<Supplier>);
//       await supplierRepo.save(supplier);
//       console.log('[seed-po] Created supplier for company', companyId);
//     } else {
//       console.log('[seed-po] Using supplier', supplier.id);
//     }

//     // ensure warehouse
//     let warehouse = await warehouseRepo.findOne({
//       where: { name: 'Main Store', companyId },
//     });
//     if (!warehouse) {
//       warehouse = warehouseRepo.create({
//         name: 'Main Store',
//         address: 'Seed Location',
//         companyId,
//       } as Partial<Warehouse>);
//       await warehouseRepo.save(warehouse);
//       console.log('[seed-po] Created warehouse for company', companyId);
//     } else {
//       console.log('[seed-po] Using warehouse', warehouse.id);
//     }

//     // ensure a user (owner)
//     let owner = await userRepo.findOne({ where: { companyId } });
//     if (!owner) {
//       owner = userRepo.create({
//         name: 'Seed Admin',
//         email: `seedadmin+${companyId.slice(0, 6)}@example.com`,
//         password: 'supersecret',
//         isActive: true,
//         companyId,
//       } as Partial<User>);
//       await userRepo.save(owner);
//       console.log('[seed-po] Created seed admin user for company', companyId);
//     } else {
//       console.log('[seed-po] Using existing user', owner.id);
//     }

//     // PO seed shapes (change these if you want)
//     const poSeedData: Array<{ items: Array<{ sku: string; qty: number }> }> = [
//       {
//         items: [
//           { sku: 'SF-1002', qty: 120 },
//           { sku: 'SF-1003', qty: 60 },
//         ],
//       },
//       {
//         items: [{ sku: 'SF-1003', qty: 200 }],
//       },
//     ];

//     async function resolveOrCreateProduct(
//       trxProductRepo: Repository<Product>,
//       sku: string,
//       nameHint: string,
//       companyIdIn: string,
//       supplierIdIn: string,
//       companyNameIn?: string,
//     ): Promise<Product> {
//       // 1) exact lookup anywhere
//       const exact = await trxProductRepo.findOne({ where: { sku } });

//       if (!exact) {
//         const created = trxProductRepo.create({
//           name: nameHint ?? sku,
//           sku,
//           unitPrice: 0,
//           companyId: companyIdIn,
//           supplierId: supplierIdIn,
//           unit: 'pcs',
//         } as Partial<Product>);
//         await trxProductRepo.save(created);
//         return created;
//       }

//       // 2) exact exists for the same company -> reuse
//       if (exact.companyId === companyIdIn) return exact;

//       // 3) exact exists but for another company -> try company-specific copy
//       const existingCopy = await trxProductRepo
//         .createQueryBuilder('p')
//         .where('p.sku LIKE :pattern', { pattern: `${sku}-%` })
//         .andWhere('p."companyId" = :cid', { cid: companyIdIn })
//         .orderBy('p."createdAt"', 'ASC')
//         .getOne();

//       if (existingCopy) return existingCopy;

//       // 4) create a new company-specific SKU copy
//       const suffix = shortCompanySuffix(companyIdIn, companyNameIn);
//       let candidateSku = `${sku}-${suffix}`;
//       let attempt = 0;
//       while (await trxProductRepo.findOne({ where: { sku: candidateSku } })) {
//         attempt += 1;
//         candidateSku = `${sku}-${suffix}-${attempt}`;
//       }

//       // Use safe property access and defaults (avoid any casts)
//       const barcodeVal = exact?.barcode;
//       const descriptionVal = exact?.description;
//       const unitPriceVal = Number(exact?.unitPrice ?? 0);
//       const unitVal = exact?.unit ?? 'pcs';

//       const copy = trxProductRepo.create({
//         name: nameHint ?? exact.name,
//         sku: candidateSku,
//         barcode: barcodeVal,
//         description: descriptionVal,
//         unitPrice: unitPriceVal,
//         companyId: companyIdIn,
//         supplierId: supplierIdIn,
//         unit: unitVal,
//       } as Partial<Product>);
//       await trxProductRepo.save(copy);
//       console.log(`[seed-po] Created company-specific product SKU=${copy.sku}`);
//       return copy;
//     }

//     // Create purchase orders inside transactions (idempotent-ish)
//     for (const poData of poSeedData) {
//       await ds.manager.transaction(async (trx) => {
//         const prodRepo = trx.getRepository(Product);
//         const stockLevelRepo = trx.getRepository(StockLevel);
//         const poRepo = trx.getRepository(PurchaseOrder);
//         const poiRepo = trx.getRepository(PurchaseOrderItem);

//         const orderNumber = `PO-SEED-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

//         // create PO
//         const createdPo = await poRepo.save({
//           orderNumber,
//           supplier,
//           warehouse,
//           createdBy: owner,
//           status: PurchaseOrderStatus.RECEIVED,
//           orderDate: new Date(),
//           expectedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
//           totalAmount: 0,
//           companyId,
//         } as Partial<PurchaseOrder>);

//         let totalNum = 0;

//         for (const { sku, qty } of poData.items) {
//           const product = await resolveOrCreateProduct(
//             prodRepo,
//             sku,
//             `Product ${sku}`,
//             companyId,
//             supplier.id,
//             companyName,
//           );

//           const unitPriceNum = Number(product.unitPrice ?? 0);
//           totalNum += unitPriceNum * Number(qty);

//           // Save PO item
//           await poiRepo.save({
//             purchaseOrderId: createdPo.id,
//             productId: product.id,
//             quantity: Number(qty),
//             receivedQty: Number(qty),
//             unitPrice: unitPriceNum.toFixed(2),
//             companyId,
//           } as Partial<PurchaseOrderItem>);

//           // Update stock level (transactional)
//           const existingSl = await stockLevelRepo.findOne({
//             where: {
//               productId: product.id,
//               warehouseId: warehouse.id,
//               companyId,
//             },
//           });
//           const existingQty = Number(existingSl?.quantity ?? 0);
//           const newQty = existingQty + Number(qty);

//           if (existingSl) {
//             existingSl.quantity = newQty;
//             await stockLevelRepo.save(existingSl);
//           } else {
//             await stockLevelRepo.save({
//               productId: product.id,
//               warehouseId: warehouse.id,
//               companyId,
//               quantity: newQty,
//             } as Partial<StockLevel>);
//           }

//           console.log(
//             `[seed-po] stock-update productId=${product.id} sku=${product.sku} new=${newQty}`,
//           );
//         }

//         await poRepo.save({
//           id: createdPo.id,
//           totalAmount: totalNum,
//           status: PurchaseOrderStatus.RECEIVED,
//         } as Partial<PurchaseOrder>);

//         console.log(
//           `[seed-po] Created PO ${createdPo.orderNumber} total ${totalNum.toFixed(2)}`,
//         );
//       });
//     }

//     console.log('[seed-po] seeding complete');
//   } catch (err) {
//     console.error('[seed-po] Purchase order seed failed:', err);
//     process.exitCode = 1;
//   } finally {
//     try {
//       if (mustDestroy && ds.isInitialized) await ds.destroy();
//     } catch (destroyErr) {
//       console.warn('[seed-po] Error while destroying datasource:', destroyErr);
//     }
//   }
// }

// // If run directly with node/ts-node
// if (require.main === module) {
//   console.log('[seed-purchase-orders] starting seed()');
//   seed().catch((e) => {
//     console.error('[seed-purchase-orders] unhandled error', e);
//     process.exit(1);
//   });
// }
