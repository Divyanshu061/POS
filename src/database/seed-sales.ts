// src/database/seed-sales.ts
import 'reflect-metadata';
import { In } from 'typeorm';
import { AppDataSource } from './data-source';

import { Sale } from '../inventory/sales/entities/sale.entity';
import { SaleItem } from '../inventory/sales/entities/sale-item.entity';
import {
  Transaction,
  TransactionType,
} from '../inventory/transaction/entities/transaction.entity';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { InvoiceStatus } from '../payment-invoice/enums/invoice-status.enum';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { PaymentMethod } from '../inventory/sales/dto/create-sale.dto';

import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { User } from '../entities/user.entity';

type ItemSeed = {
  productId: number;
  quantity: number;
  unitPrice: number;
};

/**
 * Helper: returns first entity or null (avoids findOne() with empty conditions)
 */
async function findOneOrFirst<T>(repo: {
  find(options?: any): Promise<T[]>;
}): Promise<T | null> {
  const arr = await repo.find({ take: 1 });
  return arr.length ? arr[0] : null;
}

async function run(): Promise<void> {
  await AppDataSource.initialize();

  const saleRepo = AppDataSource.getRepository(Sale);
  const transactionRepo = AppDataSource.getRepository(Transaction);
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const invoiceLineRepo = AppDataSource.getRepository(InvoiceLineItem);
  const paymentRepo = AppDataSource.getRepository(Payment);

  const clientRepo = AppDataSource.getRepository(Client);
  const companyRepo = AppDataSource.getRepository(Company);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const productRepo = AppDataSource.getRepository(Product);
  const userRepo = AppDataSource.getRepository(User);

  // Preferred IDs (from your seed logs)
  let warehouseId = 'd77471d1-29c1-4f72-a8fb-e83d2645eb0d';
  let companyId = 'efe9299c-bf23-48b4-9aea-b13d5f9eb251';
  let clientId = '4120e7a3-e11e-4c2b-b473-5a57fb004461';
  const preferredProductIds: number[] = [14, 13, 17, 16];

  // Ensure client (by id) or fallback/create one
  let client = await clientRepo.findOneBy({ id: clientId });
  if (!client) {
    const fallbackClient = await findOneOrFirst<Client>(clientRepo);
    if (fallbackClient) {
      console.warn(
        `[seed-sales] Preferred clientId ${clientId} not found — using ${fallbackClient.id}`,
      );
      client = fallbackClient;
      clientId = fallbackClient.id;
    } else {
      // Need a company for the new client
      let companyForClient = await findOneOrFirst<Company>(companyRepo);
      if (!companyForClient) {
        companyForClient = await companyRepo.save(
          companyRepo.create({ name: `Seed Company ${Date.now()}` }),
        );
      }

      // Need an owner (User) to satisfy non-nullable ownerId on Client
      const owner = await findOneOrFirst<User>(userRepo);
      if (!owner) {
        console.error(
          '[seed-sales] Cannot create client: no users present (seed users first).',
        );
        await AppDataSource.destroy();
        process.exit(1);
      }

      const createdClient = clientRepo.create({
        name: 'Seed Client',
        email: `seed.client+${Date.now()}@example.com`,
        companyId: companyForClient.id,
        ownerId: owner.id,
        status: ClientStatus.ACTIVE,
      });
      client = await clientRepo.save(createdClient);
      clientId = client.id;
      console.log(`[seed-sales] Created fallback client ${clientId}`);
    }
  }

  // Ensure company (by id) or fallback/create
  let company = await companyRepo.findOneBy({ id: companyId });
  if (!company) {
    const fallback = await findOneOrFirst<Company>(companyRepo);
    if (fallback) {
      company = fallback;
      companyId = fallback.id;
    } else {
      company = await companyRepo.save(
        companyRepo.create({ name: `Seed Company ${Date.now()}` }),
      );
      companyId = company.id;
    }
  }

  // Ensure warehouse (by id) or fallback/create
  let warehouse = await warehouseRepo.findOneBy({ id: warehouseId });
  if (!warehouse) {
    const fallback = await findOneOrFirst<Warehouse>(warehouseRepo);
    if (fallback) {
      warehouse = fallback;
      warehouseId = fallback.id;
    } else {
      warehouse = await warehouseRepo.save(
        warehouseRepo.create({ name: 'Seed Warehouse', companyId }),
      );
      warehouseId = warehouse.id;
    }
  }

  // Prepare itemsData (try preferred by id, else pick first 4 products)
  let itemsData: ItemSeed[] = [];
  const foundPreferred = await productRepo.findBy({
    id: In(preferredProductIds),
  });

  if (foundPreferred.length > 0) {
    itemsData = foundPreferred.slice(0, 4).map((p, idx) => ({
      productId: p.id,
      quantity: [5, 2, 3, 1][idx] ?? 1,
      unitPrice: 50 + idx * 30,
    }));
  } else {
    const products = await productRepo.find({ take: 4 });
    if (!products.length) {
      console.error('[seed-sales] No products found. Run product seed first.');
      await AppDataSource.destroy();
      process.exit(1);
    }
    itemsData = products.map((p, idx) => ({
      productId: p.id,
      quantity: [5, 2, 3, 1][idx] ?? 1,
      unitPrice: 50 + idx * 30,
    }));
  }

  // createdBy (optional user)
  const anyUser = await findOneOrFirst<User>(userRepo);
  const createdBy = anyUser?.id;

  console.log('[seed-sales] Using:', {
    clientId,
    companyId,
    warehouseId,
    createdBy,
    products: itemsData.map((i) => i.productId),
  });

  const totalQuantity = itemsData.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = itemsData.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );

  try {
    // Create Sale
    const sale = saleRepo.create({
      clientId,
      warehouseId,
      companyId,
      totalQuantity,
      totalAmount,
      paymentMethod: PaymentMethod.CASH,
      amountPaid: totalAmount,
      soldAt: new Date(),
      items: itemsData.map((i) =>
        Object.assign(new SaleItem(), {
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }),
      ),
    });
    const savedSale = await saleRepo.save(sale);

    // Create Transactions (OUT)
    for (const i of itemsData) {
      const tx = transactionRepo.create({
        companyId,
        productId: i.productId,
        warehouseId,
        type: TransactionType.OUT,
        quantity: i.quantity,
        reference: `Sale ${savedSale.id}`,
        createdBy, // ✅ set from earlier user
      });
      await transactionRepo.save(tx);
    }

    // Create Invoice
    const invoice = invoiceRepo.create({
      invoiceNumber: `INV-${Date.now()}`,
      clientId,
      totalAmount,
      status: InvoiceStatus.PAID,
      companyId,
      createdBy,
    });
    const savedInvoice = await invoiceRepo.save(invoice);

    // Invoice Line Items
    for (const i of itemsData) {
      const line = invoiceLineRepo.create({
        description: `Product ${i.productId}`,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.unitPrice * i.quantity,
        invoiceId: savedInvoice.id,
        companyId,
      });
      await invoiceLineRepo.save(line);
    }

    // Payment
    const payment = paymentRepo.create({
      invoiceId: savedInvoice.id,
      amount: totalAmount,
      paidAt: new Date(),
      method: PaymentMethod.CASH,
      companyId,
      createdBy,
    });
    await paymentRepo.save(payment);

    console.log(
      '✅ Seed completed: Sale, Transactions, Invoice, Payment created',
    );
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('[seed-sales] Seed failed:', err.message);
      console.error(err.stack);
    } else {
      console.error('[seed-sales] Unknown seed error:', err);
    }
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error('Unhandled error in seed-sales:', err.message);
    console.error(err.stack);
  } else {
    console.error('Unhandled unknown error in seed-sales:', err);
  }
  process.exit(1);
});
