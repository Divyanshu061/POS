// src/database/seed-payment-invoices.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';

function makeInvoiceNumber(prefix = 'INV-SEED') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const ds = AppDataSource;
  await ds.initialize();

  const userRepo = ds.getRepository(User);
  const clientRepo = ds.getRepository(Client);
  const invoiceRepo = ds.getRepository(Invoice);
  // We'll use per-transaction repos for items & payments to keep things atomic.
  try {
    // Ensure a user exists to be owner/createdBy
    let owner = await userRepo.findOne({ where: {} });
    if (!owner) {
      console.log(
        '[seed-payment] no users found — creating a lightweight seed user',
      );
      owner = userRepo.create({
        name: 'Seed Invoice User',
        email: `seed-invoice-${Date.now()}@example.com`,
        // if your User entity requires password hashing, update this to hash
        password: 'seed-password',
        isActive: true,
      } as Partial<User>);
      await userRepo.save(owner);
    }
    console.log('[seed-payment] using user:', owner.email ?? owner.id);

    // Ensure some clients exist (reuse or create)
    let clients = await clientRepo.find({ take: 3 });
    if (!clients || clients.length === 0) {
      console.log('[seed-payment] no clients found — creating sample clients');
      const created = [
        clientRepo.create({
          name: 'Seed Client A',
          company: 'Seed Co A',
          title: 'Purchasing',
          email: `client-a-${Date.now()}@example.com`,
          phone: '+91-9000000000',
          status: ClientStatus.ACTIVE,
          ownerId: owner.id,
        } as Partial<Client>),
        clientRepo.create({
          name: 'Seed Client B',
          company: 'Seed Co B',
          title: 'Manager',
          email: `client-b-${Date.now()}@example.com`,
          phone: '+91-9000000001',
          status: ClientStatus.PROSPECT,
          ownerId: owner.id,
        } as Partial<Client>),
      ];
      await clientRepo.save(created);
      clients = await clientRepo.find({ take: 3 });
    }

    const productNames = [
      'Cable Type-A',
      'PVC Pipe 2 inch',
      'Connector X',
      'Installation Service',
      'Monthly Maintenance',
    ];

    const statusOptions: Invoice['status'][] = [
      'draft',
      'issued',
      'paid',
      'cancelled',
    ];

    for (const client of clients) {
      const invoiceCount = Math.floor(Math.random() * 3) + 1; // 1-3 invoices per client
      for (let i = 0; i < invoiceCount; i++) {
        const invoiceNumber = makeInvoiceNumber();

        // Idempotency: if invoice with this number exists, skip
        const existing = await invoiceRepo.findOne({
          where: { invoiceNumber },
        });
        if (existing) {
          console.log(
            `[seed-payment] invoice ${invoiceNumber} already exists — skipping`,
          );
          continue;
        }

        await ds.manager.transaction(async (trx) => {
          const localInvoiceRepo = trx.getRepository(Invoice);
          const localItemRepo = trx.getRepository(InvoiceLineItem);
          const localPaymentRepo = trx.getRepository(Payment);

          // Pick a status with bias for issued/paid
          let status = randomChoice(statusOptions);
          if (Math.random() > 0.6) status = randomChoice(['issued', 'paid']);

          // Create invoice (totalAmount updated after items)
          let invoice = localInvoiceRepo.create({
            invoiceNumber,
            clientId: client.id,
            totalAmount: 0,
            status,
            createdBy: owner.id,
          } as Partial<Invoice>);
          invoice = await localInvoiceRepo.save(invoice);

          // Line items
          const itemCount = Math.floor(Math.random() * 4) + 1; // 1-4 items
          let totalAmount = 0;
          for (let j = 0; j < itemCount; j++) {
            const desc = randomChoice(productNames);
            const qty = Math.floor(Math.random() * 5) + 1;
            const unitPriceNum = (Math.floor(Math.random() * 5000) + 100) / 100;
            const lineTotalNum = Number((unitPriceNum * qty).toFixed(2));
            totalAmount += lineTotalNum;

            const line = localItemRepo.create({
              description: desc,
              unitPrice: unitPriceNum.toFixed(2),
              quantity: qty,
              lineTotal: lineTotalNum.toFixed(2),
              invoiceId: invoice.id,
            } as Partial<InvoiceLineItem>);
            await localItemRepo.save(line);
          }

          // Update invoice total
          invoice.totalAmount = Number(totalAmount.toFixed(2));
          await localInvoiceRepo.save(invoice);

          // Optionally create payment(s)
          if (status === 'paid' || Math.random() > 0.7) {
            const fullPay = Math.random() > 0.3; // 70% chance full when chosen
            const paidAmount = fullPay
              ? invoice.totalAmount
              : Number(
                  (invoice.totalAmount * (Math.random() * 0.5 + 0.2)).toFixed(
                    2,
                  ),
                ); // 20% - 70%

            const payment = localPaymentRepo.create({
              invoiceId: invoice.id,
              amount: paidAmount,
              paidAt: new Date(),
              method: Math.random() > 0.5 ? 'CASH' : 'CARD',
            } as Partial<Payment>);
            await localPaymentRepo.save(payment);

            // compute sum of payments using query-builder (safe typed result)
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
              invoice.status = 'paid';
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
    // keep the error object intact but stringify for eslint-safe logging
    console.error(
      '[seed-payment] Seed failed:',
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await ds.destroy();
  }
}

seed().catch((err) => {
  console.error(
    '[seed-payment] Unhandled error:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
