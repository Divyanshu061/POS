// src/database/seed-clients-invoices-payments.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { InvoiceStatus } from '../payment-invoice/enums/invoice-status.enum';

type LineItemSeed = {
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

function makeInvoiceNumber(prefix = 'INV-SEED') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

function randomLineItems(): LineItemSeed[] {
  const products = [
    'Product Alpha',
    'Product Beta',
    'Product Gamma',
    'Product Delta',
    'Product Omega',
    'Installation Service',
  ];
  const count = Math.floor(Math.random() * 3) + 1; // 1..3 items
  const items: LineItemSeed[] = [];

  for (let i = 0; i < count; i++) {
    const description = products[Math.floor(Math.random() * products.length)];
    const unitPrice = Number(
      (Math.floor(Math.random() * 200) + 50 + Math.random()).toFixed(2),
    );
    const quantity = Math.floor(Math.random() * 5) + 1;
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    items.push({ description, unitPrice, quantity, lineTotal });
  }
  return items;
}

async function seed() {
  const ds: DataSource = AppDataSource;
  if (!ds.isInitialized) await ds.initialize();

  const userRepo = ds.getRepository(User);
  const companyRepo = ds.getRepository(Company);
  const clientRepo = ds.getRepository(Client);
  const invoiceRepo = ds.getRepository(Invoice);

  // Configurable via ENV
  const defaultCompanyName = process.env.SEED_COMPANY_NAME ?? 'Default Company';
  const ownerEmailToPrefer = process.env.SEED_OWNER_EMAIL ?? '';

  try {
    // Owner user - prefer provided email, else any user
    let owner: User | null = null;
    if (ownerEmailToPrefer) {
      owner = await userRepo.findOne({ where: { email: ownerEmailToPrefer } });
    }
    if (!owner) {
      owner = await userRepo.findOne({ where: {} });
    }
    if (!owner) {
      throw new Error(
        'No user found in DB. Please run user seed before this script.',
      );
    }

    // Company
    let company = await companyRepo.findOne({
      where: { name: defaultCompanyName },
    });
    if (!company) {
      company = await companyRepo.findOne({ where: {} });
    }
    if (!company) {
      company = companyRepo.create({
        name: defaultCompanyName,
      } as Partial<Company>);
      company = await companyRepo.save(company);
      console.log('Created default company:', company.id);
    } else {
      console.log('Using company:', company.id, company.name);
    }

    // Clients to insert (idempotent by email + ownerId)
    const newClientsData: Partial<Client>[] = [
      {
        name: 'Charlie Parker',
        company,
        title: 'CEO',
        email: 'charlie.parker@example.com',
        phone: '+91-9988776655',
        status: ClientStatus.ACTIVE,
        ownerId: owner.id,
      },
      {
        name: 'Diana Prince',
        company,
        title: 'Data Lead',
        email: 'diana.prince@example.com',
        phone: '+91-8877665544',
        status: ClientStatus.PROSPECT,
        ownerId: owner.id,
      },
      {
        name: 'Ethan Hunt',
        company,
        title: 'Ops Manager',
        email: 'ethan.hunt@example.com',
        phone: '+91-7766554433',
        status: ClientStatus.ACTIVE,
        ownerId: owner.id,
      },
    ];

    const clients: Client[] = [];
    for (const c of newClientsData) {
      const existing = await clientRepo.findOne({
        where: { email: c.email!, ownerId: c.ownerId! },
      });
      if (existing) {
        clients.push(existing);
        console.log(
          `Using existing client: ${existing.name} (${existing.email})`,
        );
      } else {
        const created = clientRepo.create(c);
        const saved = await clientRepo.save(created);
        clients.push(saved);
        console.log(`Inserted client: ${saved.name} (${saved.email})`);
      }
    }

    // For each client: create 1..3 invoices in transactions
    for (const client of clients) {
      const invoiceCount = Math.floor(Math.random() * 3) + 1; // 1..3 invoices
      for (let i = 0; i < invoiceCount; i++) {
        const invoiceNumber = makeInvoiceNumber();

        // Idempotency: skip if invoiceNumber exists
        const already = await invoiceRepo.findOne({ where: { invoiceNumber } });
        if (already) continue;

        await ds.manager.transaction(async (manager) => {
          // pick a status from the enum
          const statusOptions: InvoiceStatus[] = [
            InvoiceStatus.DRAFT,
            InvoiceStatus.ISSUED,
            InvoiceStatus.PAID,
            InvoiceStatus.CANCELLED,
          ];
          const status =
            statusOptions[Math.floor(Math.random() * statusOptions.length)];

          // create invoice (companyId and createdBy set)
          let invoice = manager.create(Invoice, {
            invoiceNumber,
            clientId: client.id,
            totalAmount: 0,
            status,
            companyId: company.id,
            createdBy: owner.id,
          } as Partial<Invoice>);

          invoice = await manager.save(invoice);

          // create items using transaction manager (ensures companyId set)
          const itemsData = randomLineItems();
          let totalAmount = 0;
          const itemsToSave: InvoiceLineItem[] = itemsData.map((it) => {
            totalAmount += it.lineTotal;
            return manager.create(InvoiceLineItem, {
              description: it.description,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
              lineTotal: it.lineTotal,
              invoiceId: invoice.id,
              companyId: company.id,
            } as Partial<InvoiceLineItem>);
          });

          if (itemsToSave.length) {
            await manager.save(itemsToSave);
          }

          // update invoice total
          invoice.totalAmount = Number(totalAmount.toFixed(2));
          await manager.save(invoice);

          // optionally create payment if invoice is paid (use enum constant)
          if (status === InvoiceStatus.PAID) {
            const paidAmount =
              Math.random() > 0.3
                ? invoice.totalAmount
                : Number((invoice.totalAmount * 0.5).toFixed(2));

            const payment = manager.create(Payment, {
              invoiceId: invoice.id,
              amount: paidAmount,
              paidAt: new Date(),
              method: Math.random() > 0.5 ? 'CASH' : 'CARD',
              companyId: company.id,
              createdBy: owner.id,
            } as Partial<Payment>);

            await manager.save(payment);

            // recompute total paid and update invoice status if needed (defensive)
            const raw = await manager
              .getRepository(Payment)
              .createQueryBuilder('p')
              .select('COALESCE(SUM(p.amount),0)', 'sum')
              .where('p.invoiceId = :invoiceId', { invoiceId: invoice.id })
              .getRawOne<{ sum: string }>();

            const totalPaid = Number(raw?.sum ?? 0);
            if (invoice.totalAmount > 0 && totalPaid >= invoice.totalAmount) {
              await manager
                .getRepository(Invoice)
                .update({ id: invoice.id }, { status: InvoiceStatus.PAID });
            }
          }

          console.log(
            `Created invoice ${invoice.invoiceNumber} for client ${client.name} status=${status} total=${invoice.totalAmount}`,
          );
        });
      }
    }

    console.log('✅ Clients + Invoices + Payments seed complete.');
  } catch (err) {
    console.error(
      'Seed failed:',
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  } finally {
    await ds.destroy();
  }
}

seed().catch((err) => {
  console.error(
    'Unhandled seed error:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
