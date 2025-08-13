// src/database/seed-products.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Company } from '../inventory/company/entities/company.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';

async function seed() {
  await AppDataSource.initialize();

  const companyRepo = AppDataSource.getRepository(Company);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const productRepo = AppDataSource.getRepository(Product);
  const stockRepo = AppDataSource.getRepository(StockLevel);

  try {
    // 1) Company (find or create)
    let company = await companyRepo.findOne({ where: { name: 'Seed Co' } });
    if (!company) {
      company = await companyRepo.save({
        name: 'Seed Co',
        address: 'Seed Address',
      });
      console.log('Created company:', company.id);
    } else {
      console.log('Using existing company:', company.id);
    }

    // 2) Supplier (find or create)
    let supplier = await supplierRepo.findOne({
      where: { name: 'Sunrise Distributors', companyId: company.id },
    });
    if (!supplier) {
      supplier = await supplierRepo.save({
        name: 'Sunrise Distributors',
        companyId: company.id,
      });
      console.log('Created supplier:', supplier.id);
    } else {
      console.log('Using existing supplier:', supplier.id);
    }

    // 3) Warehouse (find or create)
    let warehouse = await warehouseRepo.findOne({
      where: { name: 'Main Store', companyId: company.id },
    });
    if (!warehouse) {
      warehouse = await warehouseRepo.save({
        name: 'Main Store',
        address: 'Ahmedabad',
        companyId: company.id,
      });
      console.log('Created warehouse:', warehouse.id);
    } else {
      console.log('Using existing warehouse:', warehouse.id);
    }

    // 4) Products (find or create by SKU)
    const seedProducts = [
      {
        name: 'Sun1 Fiber Cable A',
        sku: 'SF-1002',
        barcode: '0123456789012',
        description: 'High-quality fiber optic cable',
        unitPrice: 150.0,
        companyId: company.id,
        unit: 'pcs',
      },
      {
        name: 'Sun1 Fiber Cable B',
        sku: 'SF-1003',
        barcode: '0123456789013',
        description: 'High-quality fiber optic cable',
        unitPrice: 150.0,
        companyId: company.id,
        unit: 'pcs',
      },
    ];

    const products: Product[] = [];
    for (const p of seedProducts) {
      let existing = await productRepo.findOne({ where: { sku: p.sku } });
      if (!existing) {
        existing = await productRepo.save(p);
        console.log('Inserted product:', existing.id, existing.sku);
      } else {
        console.log('Using existing product:', existing.id, existing.sku);
      }
      products.push(existing);
    }

    // 5) Stock levels (create only if missing)
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const existingSl = await stockRepo.findOne({
        where: {
          productId: p.id,
          warehouseId: warehouse.id,
          companyId: company.id,
        },
      });
      if (!existingSl) {
        const qty = i === 0 ? 50 : 20;
        const sl = stockRepo.create({
          productId: p.id,
          warehouseId: warehouse.id,
          companyId: company.id,
          quantity: qty,
        });
        await stockRepo.save(sl);
        console.log(`Created stock level for product ${p.sku}: ${qty}`);
      } else {
        console.log(
          `Stock level exists for product ${p.sku}: ${existingSl.quantity}`,
        );
      }
    }

    console.log('Seed complete');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((e) => {
  console.error('Unhandled seed error', e);
  process.exit(1);
});
