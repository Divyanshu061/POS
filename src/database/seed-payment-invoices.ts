// src/database/seed-payment-invoices.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { InvoiceStatus } from '../payment-invoice/enums/invoice-status.enum';

function makeInvoiceNumber(prefix = 'INV-SEED') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function seed(ds = AppDataSource): Promise<void> {
  console.log('[seed-payment] starting seed...');
  await ds.initialize();
  console.log('[seed-payment] datasource initialized');

  const userRepo = ds.getRepository(User);
  const companyRepo = ds.getRepository(Company);
  const clientRepo = ds.getRepository(Client);
  const invoiceRepo = ds.getRepository(Invoice);

  try {
    // 1) Find or create an owner user (minimal)
    let owner = await userRepo.findOne({ where: {} });
    if (!owner) {
      console.log(
        '[seed-payment] no users found — creating a lightweight seed user',
      );
      owner = userRepo.create({
        name: `seed-invoice-user-${Date.now()}`,
        email: `seed-invoice-${Date.now()}@example.com`,
        password: 'seed-password',
        isActive: true,
      } as Partial<User>);
      owner = await userRepo.save(owner);
      console.log('[seed-payment] created owner:', owner.email ?? owner.id);
    } else {
      console.log('[seed-payment] using user:', owner.email ?? owner.id);
    }

    // 2) Resolve company (prefer owner.companyId)
    let company: Company | null = null;
    if (owner.companyId) {
      const found = await companyRepo.findOne({
        where: { id: owner.companyId },
      });
      if (found) {
        company = found;
        console.log(
          '[seed-payment] using owner.company:',
          company.id,
          company.name,
        );
      }
    }
    if (!company) {
      company = await companyRepo.createQueryBuilder('c').getOne();
      if (company) {
        console.log(
          '[seed-payment] using first company:',
          company.id,
          company.name,
        );
      }
    }
    if (!company) {
      const toCreate = companyRepo.create({
        name: `Seed Company ${Date.now()}`,
      });
      company = await companyRepo.save(toCreate);
      console.log('[seed-payment] created company:', company.id, company.name);
    }

    // 3) Ensure some clients exist for the company (create sample ones if none)
    let clients = await clientRepo.find({
      where: { companyId: company.id },
      take: 3,
    });
    if (!clients || clients.length === 0) {
      console.log(
        '[seed-payment] no clients for company — creating sample clients',
      );
      const created = [
        clientRepo.create({
          name: 'Seed Client A',
          // Client entity expects Company relation; using companyId is fine here (entity has companyId).
          companyId: company.id,
          title: 'Purchasing',
          email: `client-a-${Date.now()}@example.com`,
          phone: '+91-9000000000',
          status: ClientStatus.ACTIVE,
          ownerId: owner.id,
        } as Partial<Client>),
        clientRepo.create({
          name: 'Seed Client B',
          companyId: company.id,
          title: 'Manager',
          email: `client-b-${Date.now()}@example.com`,
          phone: '+91-9000000001',
          status: ClientStatus.PROSPECT,
          ownerId: owner.id,
        } as Partial<Client>),
      ];
      await clientRepo.save(created);
      clients = await clientRepo.find({
        where: { companyId: company.id },
        take: 3,
      });
    }

    const productNames = [
      'Cable Type-A',
      'PVC Pipe 2 inch',
      'Connector X',
      'Installation Service',
      'Monthly Maintenance',
    ];

    // Use actual InvoiceStatus enum values (typed)
    const statusOptions: Invoice['status'][] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.ISSUED,
      InvoiceStatus.PAID,
      InvoiceStatus.CANCELLED,
    ];

    // For each client create 1-3 invoices
    for (const client of clients) {
      const invoiceCount = Math.floor(Math.random() * 3) + 1;
      for (let idx = 0; idx < invoiceCount; idx++) {
        const invoiceNumber = makeInvoiceNumber();

        // Idempotency: skip when invoiceNumber already exists
        const exists = await invoiceRepo.findOne({ where: { invoiceNumber } });
        if (exists) {
          console.log(
            `[seed-payment] invoice ${invoiceNumber} already exists — skipping`,
          );
          continue;
        }

        await ds.manager.transaction(async (trx) => {
          const localInvoiceRepo = trx.getRepository(Invoice);
          const localItemRepo = trx.getRepository(InvoiceLineItem);
          const localPaymentRepo = trx.getRepository(Payment);

          // pick status (bias towards issued/paid)
          let status = randomChoice(statusOptions);
          if (Math.random() > 0.6) {
            status = randomChoice([InvoiceStatus.ISSUED, InvoiceStatus.PAID]);
          }

          // Create invoice (companyId/clientId/createdBy are ids on entity)
          let invoice = localInvoiceRepo.create({
            invoiceNumber,
            clientId: client.id,
            totalAmount: 0,
            status,
            companyId: company.id,
            createdBy: owner.id,
          } as Partial<Invoice>);

          invoice = await localInvoiceRepo.save(invoice);

          // add 1-4 line items
          const itemCount = Math.floor(Math.random() * 4) + 1;
          let totalAmount = 0;
          for (let j = 0; j < itemCount; j++) {
            const desc = randomChoice(productNames);
            const qty = Math.floor(Math.random() * 5) + 1;
            const unitPriceNum = (Math.floor(Math.random() * 5000) + 100) / 100;
            const lineTotalNum = round2(unitPriceNum * qty);
            totalAmount += lineTotalNum;

            const line = localItemRepo.create({
              description: desc,
              unitPrice: unitPriceNum,
              quantity: qty,
              lineTotal: lineTotalNum,
              invoiceId: invoice.id,
              companyId: company.id,
            } as Partial<InvoiceLineItem>);

            await localItemRepo.save(line);
          }

          // update invoice total
          invoice.totalAmount = round2(totalAmount);
          await localInvoiceRepo.save(invoice);

          // optionally create payment(s)
          if (invoice.status === InvoiceStatus.PAID || Math.random() > 0.7) {
            const fullPay = Math.random() > 0.3;
            const multiplier = Math.random() * 0.5 + 0.2; // 0.2 - 0.7
            const partialPaid = round2(invoice.totalAmount * multiplier);
            const paidAmount = fullPay ? invoice.totalAmount : partialPaid;

            const payment = localPaymentRepo.create({
              invoiceId: invoice.id,
              amount: paidAmount,
              paidAt: new Date(),
              method: Math.random() > 0.5 ? 'CASH' : 'CARD',
              companyId: company.id,
              createdBy: owner.id,
            } as Partial<Payment>);

            await localPaymentRepo.save(payment);

            // sum payments (typed raw result)
            const raw = await localPaymentRepo
              .createQueryBuilder('p')
              .select('COALESCE(SUM(p.amount),0)', 'sum')
              .where('p.invoiceId = :id', { id: invoice.id })
              .getRawOne<{ sum: string | number }>();

            const sumPayments = Number(raw?.sum ?? 0);
            if (
              !Number.isNaN(sumPayments) &&
              sumPayments >= Number(invoice.totalAmount)
            ) {
              invoice.status = InvoiceStatus.PAID;
              await localInvoiceRepo.save(invoice);
            }
          }

          console.log(
            `[seed-payment] Created invoice ${invoice.invoiceNumber} for client ${client.email} total=${invoice.totalAmount} status=${invoice.status}`,
          );
        }); // end transaction
      } // invoices loop
    } // clients loop

    console.log('✅ Payment + Invoice module seed complete.');
  } catch (err) {
    // stringify error safely for logging
    console.error(
      '[seed-payment] Seed failed:',
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await ds.destroy();
    console.log('[seed-payment] datasource destroyed');
  }
}

// If run directly, execute and exit accordingly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed-payment] process exiting with 0');
      process.exit(0);
    })
    .catch((err) => {
      console.error(
        '[seed-payment] Unhandled error:',
        err instanceof Error ? err.message : String(err),
      );
      if (AppDataSource.isInitialized) {
        AppDataSource.destroy().catch(() => {});
      }
      process.exit(1);
    });
}
