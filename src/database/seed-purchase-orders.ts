// src/database/seed-purchase-orders.ts
import 'reflect-metadata';
import { Repository } from 'typeorm';
import { AppDataSource } from './data-source';
import { Company } from '../inventory/company/entities/company.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { User } from '../entities/user.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../purchase-order/enums/purchase-order-status.enum';

/**
 * Helper: produce a short human-friendly suffix for a company
 * used when creating company-specific SKU variants.
 */
function shortCompanySuffix(companyId: string, companyName?: string) {
  if (companyName) {
    const token = companyName
      .split(/\s+/)[0]
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    if (token.length > 0 && token.length <= 8) return token;
  }
  return companyId.replace(/-/g, '').slice(0, 8);
}

/**
 * Idempotent seeding of purchase orders (company-aware).
 *
 * Behavior notes:
 * - If a SKU exists globally but owned by another company, we will:
 *   1) reuse any existing company-derived copy (sku LIKE 'SF-1003-%' AND companyId = ...)
 *   2) only if none found, create a new company-specific copy with a unique SKU suffix.
 */
export async function seed(ds = AppDataSource): Promise<void> {
  let mustDestroy = false;
  try {
    if (!ds.isInitialized) {
      await ds.initialize();
      mustDestroy = true;
    }

    const companyRepo = ds.getRepository(Company);
    const supplierRepo = ds.getRepository(Supplier);
    const warehouseRepo = ds.getRepository(Warehouse);
    const userRepo = ds.getRepository(User);

    // Find company (prefer Seed Co)
    let company = await companyRepo.findOneBy({ name: 'Seed Co' });
    if (!company) {
      const companies = await companyRepo.find({ take: 1 });
      company = companies[0];
    }
    if (!company) throw new Error('Company not found. Seed company first.');

    const companyId = company.id;
    const companyName = company.name;

    // Ensure supplier
    let supplier = await supplierRepo.findOne({
      where: { name: 'Sunrise Distributors', companyId },
    });
    if (!supplier) {
      supplier = supplierRepo.create({
        name: 'Sunrise Distributors',
        companyId,
      });
      await supplierRepo.save(supplier);
      console.log('[po] Created supplier for company', companyId);
    } else {
      console.log('[po] Using supplier', supplier.id);
    }
    const supplierId = supplier.id;

    // Ensure warehouse
    let warehouse = await warehouseRepo.findOne({
      where: { name: 'Main Store', companyId },
    });
    if (!warehouse) {
      warehouse = warehouseRepo.create({
        name: 'Main Store',
        address: 'Seed Location',
        companyId,
      });
      await warehouseRepo.save(warehouse);
      console.log(
        '[po] Created warehouse for company',
        companyId,
        warehouse.id,
      );
    } else {
      console.log('[po] Using warehouse', warehouse.id);
    }

    // Ensure owner user (createdBy)
    let owner = await userRepo.findOneBy({ companyId });
    if (!owner) {
      owner = userRepo.create({
        name: 'Seed Admin',
        email: `seedadmin+${companyId.slice(0, 6)}@example.com`,
        password: 'supersecret',
        isActive: true,
        company,
      });
      await userRepo.save(owner);
      console.log('[po] Created seed admin user for company', companyId);
    } else {
      console.log('[po] Using existing user', owner.id);
    }

    // Example PO data — adjust as you like
    const poSeedData: Array<{ items: Array<{ sku: string; qty: number }> }> = [
      {
        items: [
          { sku: 'SF-1002', qty: 120 },
          { sku: 'SF-1003', qty: 60 },
        ],
      },
      { items: [{ sku: 'SF-1003', qty: 200 }] },
    ];

    /**
     * Idempotent resolver:
     * - If exact SKU doesn't exist at all -> create product for this company with that SKU.
     * - If exact SKU exists and is for this company -> reuse it.
     * - If exact SKU exists but for another company:
     *     a) try to find an existing company-derived copy (sku LIKE 'SF-1003-%' AND companyId = ...)
     *     b) if found -> reuse it
     *     c) otherwise create a new company-specific copy (unique SKU)
     */
    async function resolveOrCreateProduct(
      trxProductRepo: Repository<Product>,
      sku: string,
      nameHint: string,
      companyIdIn: string,
      supplierIdIn: string,
      companyNameIn?: string,
    ): Promise<Product> {
      // 1) exact lookup (global or company)
      const exact = await trxProductRepo.findOne({ where: { sku } });
      if (!exact) {
        // No product exists with this SKU anywhere — create one for this company with the given SKU
        const created = trxProductRepo.create({
          name: nameHint ?? sku,
          sku,
          unitPrice: 0,
          companyId: companyIdIn,
          supplierId: supplierIdIn,
          unit: 'pcs',
        } as Partial<Product>);
        await trxProductRepo.save(created);
        return created;
      }

      // 2) exact exists for the same company -> reuse
      if (exact.companyId === companyIdIn) return exact;

      // 3) exact exists but for another company. Try to find an existing company copy first.
      const existingCopy = await trxProductRepo
        .createQueryBuilder('p')
        .where('p.sku LIKE :pattern', { pattern: `${sku}-%` })
        .andWhere('p."companyId" = :cid', { cid: companyIdIn })
        .orderBy('p."createdAt"', 'ASC')
        .getOne();

      if (existingCopy) return existingCopy;

      // 4) No existing company copy found — create a new unique company-specific SKU
      const suffix = shortCompanySuffix(companyIdIn, companyNameIn);
      let candidateSku = `${sku}-${suffix}`;
      let attempt = 0;
      // ensure unique SKU
      while (await trxProductRepo.findOne({ where: { sku: candidateSku } })) {
        attempt += 1;
        candidateSku = `${sku}-${suffix}-${attempt}`;
      }

      const copy = trxProductRepo.create({
        name: nameHint ?? exact.name,
        sku: candidateSku,
        barcode: exact.barcode,
        description: exact.description,
        unitPrice: exact.unitPrice,
        companyId: companyIdIn,
        supplierId: supplierIdIn,
        unit: exact.unit ?? 'pcs',
      } as Partial<Product>);
      await trxProductRepo.save(copy);
      console.log(
        `[po] Created company-specific product ${copy.id} SKU=${copy.sku} (original=${exact.id})`,
      );
      return copy;
    }

    // Create POs inside transactions
    for (const poData of poSeedData) {
      const orderNumber = `PO-SEED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      await ds.manager.transaction(async (trx) => {
        const prodRepo: Repository<Product> = trx.getRepository(Product);
        const stockLevelRepo: Repository<StockLevel> =
          trx.getRepository(StockLevel);
        const poRepo: Repository<PurchaseOrder> =
          trx.getRepository(PurchaseOrder);
        const poiRepo: Repository<PurchaseOrderItem> =
          trx.getRepository(PurchaseOrderItem);

        const createdPo = await poRepo.save({
          orderNumber,
          supplier,
          warehouse,
          createdBy: owner,
          status: PurchaseOrderStatus.RECEIVED,
          orderDate: new Date(),
          expectedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          totalAmount: 0,
        } as Partial<PurchaseOrder>);

        let totalNum = 0;

        for (const { sku, qty } of poData.items) {
          const product = await resolveOrCreateProduct(
            prodRepo,
            sku,
            `Product ${sku}`,
            companyId,
            supplierId,
            companyName,
          );

          const unitPriceNum = Number(product.unitPrice ?? 0);
          totalNum += unitPriceNum * Number(qty);

          // Save PO item
          await poiRepo.save({
            purchaseOrderId: createdPo.id,
            productId: product.id,
            quantity: Number(qty),
            receivedQty: Number(qty),
            unitPrice: unitPriceNum.toFixed(2),
          } as Partial<PurchaseOrderItem>);

          // Update stock level (transactional)
          const existingSl = await stockLevelRepo.findOne({
            where: {
              productId: product.id,
              warehouseId: warehouse.id,
              companyId,
            },
          });
          const existingQty = Number(existingSl?.quantity ?? 0);
          const newQty = existingQty + Number(qty);

          if (Number.isNaN(newQty)) {
            throw new Error(
              `Invalid arithmetic for product ${product.id} (existing=${existingQty} received=${qty})`,
            );
          }
          if (newQty < 0) {
            throw new Error(
              `Refusing to set negative stock for product ${product.id} sku=${product.sku}`,
            );
          }

          if (existingSl) {
            existingSl.quantity = newQty;
            await stockLevelRepo.save(existingSl);
          } else {
            await stockLevelRepo.save({
              productId: product.id,
              warehouseId: warehouse.id,
              companyId,
              quantity: newQty,
            } as Partial<StockLevel>);
          }

          console.log(
            `[po] stock-update productId=${product.id} sku=${product.sku} existing=${existingQty} received=${qty} new=${newQty}`,
          );
        }

        await poRepo.save({
          id: createdPo.id,
          totalAmount: totalNum,
          status: PurchaseOrderStatus.RECEIVED,
        } as Partial<PurchaseOrder>);
        console.log(
          `[po] ✅ Created PO ${orderNumber} with total ${totalNum.toFixed(2)}`,
        );
      });
    }

    console.log('[po] Purchase order seeding complete');
    return;
  } catch (err) {
    console.error('[po] Purchase order seed failed:', err);
    process.exitCode = 1;
    return;
  } finally {
    try {
      if (mustDestroy && ds.isInitialized) await ds.destroy();
    } catch (destroyErr) {
      console.warn('[po] Error while destroying datasource:', destroyErr);
    }
  }
}

// runnable directly
if (require.main === module) {
  console.log('[seed-purchase-orders] running as script — starting seed()');
  seed().catch((err) => {
    console.error('[seed-purchase-orders] Unhandled error:', err);
    process.exit(1);
  });
}
