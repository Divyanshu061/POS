// src/database/seed-products.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Product } from '../inventory/product/entities/product.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';

function shortCompanySuffix(companyId: string, companyName?: string) {
  // try human-friendly short name, fallback to id slice
  if (companyName) {
    const token = companyName
      .split(/\s+/)[0]
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase();
    if (token.length > 0 && token.length <= 8) return token;
  }
  return companyId.replace(/-/g, '').slice(0, 8);
}

export async function seed(ds = AppDataSource) {
  let mustDestroy = false;
  try {
    if (!ds.isInitialized) {
      await ds.initialize();
      mustDestroy = true;
    }

    const companyRepo = ds.getRepository(Company);
    const productRepo = ds.getRepository(Product);
    const supplierRepo = ds.getRepository(Supplier);
    const warehouseRepo = ds.getRepository(Warehouse);
    const stockRepo = ds.getRepository(StockLevel);

    // find company
    let company = await companyRepo.findOneBy({ name: 'Seed Co' });
    if (!company) {
      const companies = await companyRepo.find({ take: 1 });
      company = companies[0];
    }
    if (!company) throw new Error('No company found — seed companies first.');

    // ensure warehouse
    let warehouse = await warehouseRepo.findOne({
      where: { name: 'Main Store', companyId: company.id },
    });
    if (!warehouse) {
      warehouse = warehouseRepo.create({
        name: 'Main Store',
        address: 'Seed Location',
        companyId: company.id,
      });
      await warehouseRepo.save(warehouse);
      console.log('[products] Created warehouse:', warehouse.id);
    } else {
      console.log('[products] Using warehouse:', warehouse.id);
    }

    // ensure supplier
    let supplier = await supplierRepo.findOne({
      where: { name: 'Sunrise Distributors', companyId: company.id },
    });
    if (!supplier) {
      supplier = supplierRepo.create({
        name: 'Sunrise Distributors',
        companyId: company.id,
      });
      await supplierRepo.save(supplier);
      console.log('[products] Created supplier:', supplier.id);
    } else {
      console.log('[products] Using supplier:', supplier.id);
    }

    // products to seed
    const seedProducts = [
      {
        name: 'Sun1 Fiber Cable A',
        sku: 'SF-1002',
        barcode: '0123456789012',
        description: 'High-quality fiber optic cable',
        unitPrice: 150.0,
        companyId: company.id,
        unit: 'pcs',
        supplierId: supplier.id,
      },
      {
        name: 'Sun1 Fiber Cable B',
        sku: 'SF-1003',
        barcode: '0123456789013',
        description: 'High-quality fiber optic cable',
        unitPrice: 150.0,
        companyId: company.id,
        unit: 'pcs',
        supplierId: supplier.id,
      },
    ];

    const products: Product[] = [];

    for (const p of seedProducts) {
      // global SKU check
      const global = await productRepo.findOne({ where: { sku: p.sku } });

      if (!global) {
        // safe to create with requested SKU
        const created = productRepo.create(p as Partial<Product>);
        await productRepo.save(created);
        console.log('[products] Inserted product:', created.id, created.sku);
        products.push(created);
        continue;
      }

      // SKU exists somewhere
      if (global.companyId === company.id) {
        console.log(
          '[products] Using existing product (same company):',
          global.id,
          global.sku,
        );
        products.push(global);
        continue;
      }

      // SKU exists but belongs to another company -> create a company-specific copy with modified SKU
      const suffix = shortCompanySuffix(company.id, company.name);
      let candidateSku = `${p.sku}-${suffix}`;
      // ensure uniqueness (add numeric suffix if collision)
      let attempt = 0;
      while (await productRepo.findOne({ where: { sku: candidateSku } })) {
        attempt += 1;
        candidateSku = `${p.sku}-${suffix}-${attempt}`;
      }

      const copy: Partial<Product> = {
        ...p,
        sku: candidateSku,
        companyId: company.id,
      };
      const createdCopy = productRepo.create(copy);
      await productRepo.save(createdCopy);
      console.log(
        `[products] SKU ${p.sku} already existed for productId=${global.id} companyId=${global.companyId}. Created company-specific product ${createdCopy.id} with SKU=${createdCopy.sku}`,
      );
      products.push(createdCopy);
    }

    // create stock levels only for products that belong to this company
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (prod.companyId !== company.id) {
        console.warn(
          `[products] skipping stock-level for ${prod.sku} (company mismatch ${prod.companyId} !== ${company.id})`,
        );
        continue;
      }

      const existingSl = await stockRepo.findOne({
        where: {
          productId: prod.id,
          warehouseId: warehouse.id,
          companyId: company.id,
        },
      });
      if (!existingSl) {
        const qty = i === 0 ? 50 : 20;
        const sl = stockRepo.create({
          productId: prod.id,
          warehouseId: warehouse.id,
          companyId: company.id,
          quantity: qty,
        });
        await stockRepo.save(sl);
        console.log(
          `[products] Created stock level for product ${prod.sku}: ${qty}`,
        );
      } else {
        console.log(
          `[products] Stock level exists for product ${prod.sku}: ${existingSl.quantity}`,
        );
      }
    }

    console.log('[products] Seed complete');
  } catch (err) {
    console.error('[products] Seed failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      if (mustDestroy && ds.isInitialized) await ds.destroy();
    } catch (destroyErr) {
      console.warn('[products] Error while destroying datasource:', destroyErr);
    }
  }
}

// top-level runner
if (require.main === module) {
  console.log('[seed-products] running as script — starting seed()');
  seed().catch((err) => {
    console.error('[seed-products] Unhandled error:', err);
    process.exit(1);
  });
}
