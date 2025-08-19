// src/database/dedupe-products.ts

/**
 * Script: dedupe-products.ts
 *
 * Purpose:
 * - Detect duplicate products within the same company based on (sku, companyId).
 * - Keep the earliest created product as the original.
 * - Update duplicate SKUs by appending "-SEED" (e.g., "SF-1002" → "SF-1002-SEED").
 * - Ensures SKU uniqueness across products without deleting data.
 *
 * Usage:
 * Run this script after seeding to clean up duplicate SKUs.
 * Example: npm run ts-node src/database/dedupe-products.ts
 *
 * Notes:
 * - Original records remain unchanged.
 * - Only duplicates are renamed.
 * - Safe to re-run multiple times (idempotent).
 */

import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Product } from '../inventory/product/entities/product.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';

type Mode = 'dry' | 'apply';

interface CountRes {
  cnt: number | string;
}

interface StockRow {
  id: string;
  productId: string;
  warehouseId: string;
  companyId: string;
  quantity: number | string | null;
  // other columns allowed but not required
}

/* ---------- runtime type guards ---------- */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isCountResArray(v: unknown): v is CountRes[] {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (!isObject(item)) return false;
    // cnt may come as number or string (depending on DB driver), accept both
    return (
      'cnt' in item &&
      (typeof item.cnt === 'number' || typeof item.cnt === 'string')
    );
  });
}

function isStockRowArray(v: unknown): v is StockRow[] {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (!isObject(item)) return false;
    return (
      typeof item.id === 'string' &&
      typeof item.productId === 'string' &&
      typeof item.warehouseId === 'string' &&
      typeof item.companyId === 'string' &&
      (typeof item.quantity === 'number' ||
        typeof item.quantity === 'string' ||
        item.quantity === null)
    );
  });
}

function extractCountFromUnknownQueryResult(res: unknown): number {
  if (isCountResArray(res) && res.length > 0) {
    const raw = res[0].cnt;
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/* ---------- main ---------- */

async function run(): Promise<void> {
  const modeArg = process.argv.includes('--apply')
    ? 'apply'
    : process.argv.includes('--dry-run')
      ? 'dry'
      : 'dry';
  const mode: Mode = modeArg === 'apply' ? 'apply' : 'dry';

  console.log(
    '[dedupe] starting dedupe-products script - BACKUP your DB before running!',
  );
  console.log(
    '[dedupe] mode:',
    mode === 'dry' ? 'DRY-RUN (no writes)' : 'APPLY (will modify DB)',
  );

  const ds = AppDataSource;
  await ds.initialize();

  try {
    console.log('[dedupe] scanning products for "-SEED" copies...');
    const productRepo = ds.getRepository(Product);

    const seedProducts = await productRepo
      .createQueryBuilder('p')
      .where('p.sku ILIKE :pattern', { pattern: '%-SEED%' })
      .orderBy('p.companyId', 'ASC')
      .addOrderBy('p.createdAt', 'ASC')
      .getMany();

    if (seedProducts.length === 0) {
      console.log('[dedupe] no -SEED products found. exiting.');
      return;
    }

    // group by companyId + baseSku
    type GroupKey = string; // companyId::baseSku
    const groups = new Map<GroupKey, Product[]>();
    for (const p of seedProducts) {
      const baseSku = (p.sku || '').split(/-SEED/i)[0];
      const key = `${p.companyId}::${baseSku}`;
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }

    const actionableGroups = Array.from(groups.entries()).filter(
      ([, prods]) => prods.length > 1,
    );

    console.log(
      `[dedupe] found ${groups.size} candidate group(s) by company+baseSKU; ${actionableGroups.length} group(s) need merging`,
    );

    // table names for raw queries
    const poiTable = 'purchase_order_item';
    const saleTable = 'sale_items';
    const txTable = 'transactions';

    for (const [key, products] of actionableGroups) {
      const [companyId, baseSku] = key.split('::');
      console.log('[dedupe] processing group:', {
        companyId,
        baseSku,
        count: products.length,
      });

      // transaction per group to keep atomic
      await ds.manager.transaction(async (trx) => {
        const canonical = products[0]; // earliest created (we ordered)
        console.log('[dedupe] canonical product chosen:', {
          id: canonical.id,
          sku: canonical.sku,
        });

        for (let i = 1; i < products.length; i += 1) {
          const dup = products[i];
          console.log('[dedupe] candidate duplicate:', {
            id: dup.id,
            sku: dup.sku,
          });

          // DRY-RUN: only report what would happen
          if (mode === 'dry') {
            const poiCountRaw: unknown = await trx.query(
              `SELECT COUNT(*)::int AS cnt FROM ${poiTable} WHERE product_id = $1`,
              [dup.id],
            );
            const poiCount = extractCountFromUnknownQueryResult(poiCountRaw);

            const saleCountRaw: unknown = await trx.query(
              `SELECT COUNT(*)::int AS cnt FROM ${saleTable} WHERE "productId" = $1`,
              [dup.id],
            );
            const saleCount = extractCountFromUnknownQueryResult(saleCountRaw);

            const txCountRaw: unknown = await trx.query(
              `SELECT COUNT(*)::int AS cnt FROM ${txTable} WHERE "productId" = $1`,
              [dup.id],
            );
            const txCount = extractCountFromUnknownQueryResult(txCountRaw);

            const dupStockRowsRaw: unknown = await trx.query(
              `SELECT * FROM stock_levels WHERE "productId" = $1`,
              [dup.id],
            );
            const dupStockRows: StockRow[] = isStockRowArray(dupStockRowsRaw)
              ? dupStockRowsRaw
              : [];

            console.log(
              '[dry] would update purchase_order_item rows:',
              poiCount,
            );
            console.log('[dry] would update sale_items rows:', saleCount);
            console.log('[dry] would update transactions rows:', txCount);

            if (dupStockRows.length === 0) {
              console.log(
                '[dry] no stock_levels rows for duplicate product:',
                dup.id,
              );
            } else {
              for (const dupSl of dupStockRows) {
                const canonicalSlRaw: unknown = await trx.query(
                  'SELECT * FROM stock_levels WHERE "productId" = $1 AND "warehouseId" = $2 AND "companyId" = $3 LIMIT 1',
                  [canonical.id, dupSl.warehouseId, dupSl.companyId],
                );
                const canonicalSl =
                  isStockRowArray(canonicalSlRaw) && canonicalSlRaw.length
                    ? canonicalSlRaw[0]
                    : null;

                if (canonicalSl) {
                  const existingQty = Number(canonicalSl.quantity ?? 0);
                  const addQty = Number(dupSl.quantity ?? 0);
                  const newQty = existingQty + addQty;
                  console.log('[dry] WOULD MERGE stock row:', {
                    dupStockId: dupSl.id,
                    warehouseId: dupSl.warehouseId,
                    canonicalStockId: canonicalSl.id,
                    existingQty,
                    addQty,
                    newQty,
                  });
                } else {
                  console.log(
                    '[dry] WOULD REASSIGN stock row to canonical product:',
                    {
                      dupStockId: dupSl.id,
                      warehouseId: dupSl.warehouseId,
                      oldProductId: dupSl.productId,
                      newProductId: canonical.id,
                      qty: dupSl.quantity,
                    },
                  );
                }
              }
            }

            console.log('---');
            continue; // next duplicate
          } // end dry-run

          // APPLY: perform updates inside the transaction

          // 1) purchase_order_item -> product_id
          const poiUpdate = await trx
            .createQueryBuilder()
            .update(poiTable)
            .set({ product_id: canonical.id })
            .where('product_id = :dupId', { dupId: dup.id })
            .execute();
          console.log(
            '[dedupe] purchase_order_item rows updated:',
            poiUpdate.affected ?? 0,
          );

          // 2) sale_items -> productId
          const saleUpd = await trx
            .createQueryBuilder()
            .update(saleTable)
            .set({ productId: canonical.id })
            .where('"productId" = :dupId', { dupId: dup.id })
            .execute();
          console.log(
            '[dedupe] sale_item rows updated:',
            saleUpd.affected ?? 0,
          );

          // 3) transactions -> productId (bump updatedAt)
          const txUpd = await trx
            .createQueryBuilder()
            .update(txTable)
            .set({
              productId: canonical.id,
              updatedAt: () => 'CURRENT_TIMESTAMP',
            })
            .where('"productId" = :dupId', { dupId: dup.id })
            .execute();
          console.log(
            '[dedupe] transaction rows updated:',
            txUpd.affected ?? 0,
          );

          // 4) stock_levels - merge or reassign
          const dupStockRows: StockLevel[] = await trx
            .getRepository(StockLevel)
            .find({
              where: { productId: dup.id },
            });

          for (const dupSl of dupStockRows) {
            const canonicalSl = await trx.getRepository(StockLevel).findOne({
              where: {
                productId: canonical.id,
                warehouseId: dupSl.warehouseId,
                companyId: dupSl.companyId,
              },
            });

            if (canonicalSl) {
              const existingQty = Number(canonicalSl.quantity ?? 0);
              const addQty = Number(dupSl.quantity ?? 0);
              const newQty = existingQty + addQty;

              await trx
                .getRepository(StockLevel)
                .update({ id: canonicalSl.id }, { quantity: newQty });
              await trx.getRepository(StockLevel).delete({ id: dupSl.id });

              console.log('[dedupe] merged stockLevels:', {
                warehouseId: dupSl.warehouseId,
                canonicalStockId: canonicalSl.id,
                dupStockId: dupSl.id,
                newQty,
              });
            } else {
              await trx
                .getRepository(StockLevel)
                .update({ id: dupSl.id }, { productId: canonical.id });
              console.log('[dedupe] reassigned stockLevel', {
                dupStockId: dupSl.id,
                newProductId: canonical.id,
              });
            }
          }

          // 5) delete duplicate product
          await trx.getRepository(Product).delete({ id: dup.id });
          console.log('[dedupe] deleted product:', dup.id, dup.sku);
        } // end duplicates loop

        console.log('[dedupe] finished merging group:', { companyId, baseSku });
      }); // end transaction
    } // end actionable groups loop

    console.log('[dedupe] all groups processed. dedupe complete.');
  } catch (err) {
    console.error('[dedupe] script failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (ds.isInitialized) await ds.destroy();
    } catch (e) {
      console.warn('[dedupe] error destroying datasource:', e);
    }
  }
}

/* runnable */
if (require.main === module) {
  run()
    .then(() => {
      console.log('[dedupe] script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[dedupe] unhandled error:', err);
      process.exit(1);
    });
}
