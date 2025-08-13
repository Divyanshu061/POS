// src/database/seed-purchase-orders.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { User } from '../entities/user.entity';

import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';
import { PurchaseOrderStatus } from '../purchase-order/enums/purchase-order-status.enum';

async function seed() {
  await AppDataSource.initialize();

  const companyRepo = AppDataSource.getRepository(Company);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const productRepo = AppDataSource.getRepository(Product);
  const userRepo = AppDataSource.getRepository(User);
  const poRepo = AppDataSource.getRepository(PurchaseOrder);

  try {
    // company context
    const company = await companyRepo.findOne({
      where: { id: '421e0488-aa80-4ade-ad90-2b458b7e4de8' },
    });
    if (!company)
      throw new Error('Company "Seed Co" not found. Run product seed first.');
    console.log('Using company:', company.id);

    // supplier & warehouse
    const supplier = await supplierRepo.findOne({
      where: { name: 'Sunrise Distributors', companyId: company.id },
    });
    if (!supplier) {
      throw new Error(
        'Supplier "Sunrise Distributors" not found. Seed suppliers first.',
      );
    }
    console.log('Using supplier:', supplier.id);

    const warehouse = await warehouseRepo.findOne({
      where: { name: 'Main Store', companyId: company.id },
    });
    if (!warehouse) {
      throw new Error(
        'Warehouse "Main Store" not found. Seed warehouses first.',
      );
    }
    console.log('Using warehouse:', warehouse.id);

    // user as createdBy
    const owner = (await userRepo.find({ take: 1 }))[0];
    if (!owner) throw new Error('No users found — seed users first.');
    console.log('Using user (createdBy):', owner.id);

    // products by SKU
    const skuList = ['SF-1002', 'SF-1003'];
    const products: Product[] = [];
    for (const sku of skuList) {
      const p = await productRepo.findOne({
        where: { sku, companyId: company.id },
      });
      if (!p) {
        console.warn(`Product with SKU ${sku} not found. Skipping.`);
        continue;
      }
      products.push(p);
    }
    if (products.length === 0)
      throw new Error('No seed products found; aborting PO seed.');

    // idempotent check using orderNumber
    const orderNumber = 'PO-SEED-001';
    const existingPo = await poRepo.findOne({ where: { orderNumber } });

    if (existingPo) {
      console.log(
        'Using existing Purchase Order:',
        existingPo.id,
        existingPo.orderNumber,
      );
    } else {
      // create PO and items in a transaction
      await AppDataSource.manager.transaction(async (trx) => {
        const poData: Partial<PurchaseOrder> = {
          orderNumber,
          supplier,
          warehouse,
          createdBy: owner,
          status: PurchaseOrderStatus.RECEIVED,
          orderDate: new Date(),
          expectedDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          totalAmount: 0,
        };

        const createdPo = await trx
          .getRepository(PurchaseOrder)
          .save(poData as PurchaseOrder);
        console.log(
          'Created Purchase Order:',
          createdPo.id,
          createdPo.orderNumber ?? orderNumber,
        );

        let totalNum = 0;

        for (let i = 0; i < products.length; i++) {
          const prod = products[i];
          const qty = i === 0 ? 100 : 50;
          const unitPriceNum = Number(prod.unitPrice ?? 0);
          const lineTotalNum = unitPriceNum * qty;
          totalNum += lineTotalNum;

          // PurchaseOrderItem.unitPrice is defined as decimal → string in your entity,
          // so we use toFixed to write a decimal string.
          const item: Partial<PurchaseOrderItem> = {
            purchaseOrderId: createdPo.id,
            productId: prod.id,
            quantity: qty,
            receivedQty: qty,
            unitPrice: unitPriceNum.toFixed(2),
          };

          await trx
            .getRepository(PurchaseOrderItem)
            .save(item as PurchaseOrderItem);
          console.log(
            `Created PO item for product ${prod.sku}: qty=${qty}, unitPrice=${unitPriceNum}`,
          );

          // update stock level
          const existingSl = await trx.getRepository(StockLevel).findOne({
            where: {
              productId: prod.id,
              warehouseId: warehouse.id,
              companyId: prod.companyId,
            },
          });

          if (existingSl) {
            existingSl.quantity = (existingSl.quantity ?? 0) + qty;
            await trx.getRepository(StockLevel).save(existingSl);
            console.log(
              `Increased stock for ${prod.sku} by ${qty} (new=${existingSl.quantity})`,
            );
          } else {
            const sl = trx.getRepository(StockLevel).create({
              productId: prod.id,
              warehouseId: warehouse.id,
              companyId: prod.companyId,
              quantity: qty,
            });
            await trx.getRepository(StockLevel).save(sl);
            console.log(`Created stock level for ${prod.sku}: ${qty}`);
          }
        }

        // update PO totals & keep it received
        const updateData: Partial<PurchaseOrder> = {
          id: createdPo.id,
          totalAmount: totalNum,
          status: PurchaseOrderStatus.RECEIVED,
        };
        await trx
          .getRepository(PurchaseOrder)
          .save(updateData as PurchaseOrder);
        console.log(
          `Purchase Order ${orderNumber} marked received, total=${totalNum.toFixed(2)}`,
        );
      });
    }

    console.log('Purchase order seed complete');
  } catch (err) {
    console.error('Purchase order seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((e) => {
  console.error('Unhandled purchase order seed error', e);
  process.exit(1);
});
