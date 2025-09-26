// src/database/seed-invoices-payments.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { User } from '../entities/user.entity';
import { Company } from '../inventory/company/entities/company.entity';

export async function seed(ds = AppDataSource): Promise<void> {
  console.log('[seed-invoices-payments] starting seed...');
  await ds.initialize();
  console.log('[seed-invoices-payments] datasource initialized');

  const userRepo = ds.getRepository(User);
  const companyRepo = ds.getRepository(Company);
  const clientRepo = ds.getRepository(Client);
  const invoiceRepo = ds.getRepository(Invoice);
  const itemRepo = ds.getRepository(InvoiceLineItem);
  const paymentRepo = ds.getRepository(Payment);

  const envOwnerId = process.env.SEED_OWNER_ID ?? '';
  const envCompanyId = process.env.SEED_COMPANY_ID ?? '';
  const envClientId = process.env.SEED_CLIENT_ID ?? '';

  // 1) Resolve owner (env -> first existing -> create)
  let owner: User | null = null;

  if (envOwnerId) {
    owner = await userRepo.findOne({ where: { id: envOwnerId } });
    if (!owner) {
      console.warn(
        `[seed-invoices-payments] no user found for SEED_OWNER_ID=${envOwnerId}`,
      );
    } else {
      console.log(
        `[seed-invoices-payments] using owner from SEED_OWNER_ID: ${owner.id} (${owner.email ?? 'no email'})`,
      );
    }
  }

  if (!owner) {
    owner = await userRepo.createQueryBuilder('u').getOne();
    if (!owner) {
      // create minimal user
      const tmpUser = userRepo.create({
        name: `seed-user-${Date.now()}`,
        email: `seed-user-${Date.now()}@example.com`,
        password: 'password',
        isActive: true,
      } as Partial<User>);
      owner = await userRepo.save(tmpUser);
      console.log(
        `[seed-invoices-payments] created owner: ${owner.id} (${owner.email})`,
      );
    } else {
      console.log(
        `[seed-invoices-payments] using first existing user: ${owner.id} (${owner.email ?? 'no email'})`,
      );
    }
  }

  // 2) Resolve company (env -> owner.companyId -> first company -> create)
  let company: Company | null = null;

  if (envCompanyId) {
    const found = await companyRepo.findOne({ where: { id: envCompanyId } });
    if (found) {
      company = found;
      console.log(
        `[seed-invoices-payments] using company from env: ${company.id} (${company.name})`,
      );
    } else {
      console.warn(
        `[seed-invoices-payments] no company for SEED_COMPANY_ID=${envCompanyId}`,
      );
    }
  }

  if (!company && owner && owner.companyId) {
    const found = await companyRepo.findOne({ where: { id: owner.companyId } });
    if (found) {
      company = found;
      console.log(
        `[seed-invoices-payments] using owner's company: ${company.id} (${company.name})`,
      );
    }
  }

  if (!company) {
    const firstCompany = await companyRepo.createQueryBuilder('c').getOne();
    if (firstCompany) {
      company = firstCompany;
      console.log(
        `[seed-invoices-payments] using first existing company: ${company.id} (${company.name})`,
      );
    }
  }

  if (!company) {
    const created = companyRepo.create({ name: `Seed Company ${Date.now()}` });
    company = await companyRepo.save(created);
    console.log(
      `[seed-invoices-payments] created default company: ${company.id} (${company.name})`,
    );
  }

  // 3) Resolve client (env -> first client for company -> create)
  let client: Client | null = null;

  if (envClientId) {
    client = await clientRepo.findOne({ where: { id: envClientId } });
    if (client) {
      console.log(
        `[seed-invoices-payments] using client from env: ${client.id} (${client.email})`,
      );
    } else {
      console.warn(
        `[seed-invoices-payments] no client found for SEED_CLIENT_ID=${envClientId}`,
      );
    }
  }

  if (!client) {
    client = await clientRepo.findOne({ where: { companyId: company.id } });
    if (client) {
      console.log(
        `[seed-invoices-payments] using first client for company: ${client.id} (${client.email})`,
      );
    }
  }

  if (!client) {
    const newClient = clientRepo.create({
      name: `Seed Client ${Date.now()}`,
      title: 'Contact',
      email: `client-${Date.now()}@example.com`,
      phone: '+91-9000000000',
      status: ClientStatus.ACTIVE,
      ownerId: owner.id,
      companyId: company.id,
    } as Partial<Client>);
    client = await clientRepo.save(newClient);
    console.log(
      `[seed-invoices-payments] created client: ${client.id} (${client.email})`,
    );
  }

  // 4) Create invoice
  // Provide ID fields (createdBy, clientId, companyId) because entities declare those columns as uuid
  const invoiceNumber = `INV-${Date.now()}`;

  const invoicePayload: Partial<Invoice> = {
    invoiceNumber,
    clientId: client.id,
    companyId: company.id,
    totalAmount: 0,
    createdBy: owner.id, // column is string uuid
    // status omitted so entity default (InvoiceStatus.DRAFT) applies
  };

  let invoice = invoiceRepo.create(invoicePayload);
  invoice = await invoiceRepo.save(invoice);

  // 5) Line items and total calculation
  const itemsToAdd: Array<{
    description: string;
    unitPrice: number;
    quantity: number;
  }> = [
    { description: 'Product A', unitPrice: 50, quantity: 2 },
    { description: 'Product B', unitPrice: 80, quantity: 1 },
  ];

  let totalAmount = 0;
  for (const it of itemsToAdd) {
    const lineTotal = Number((it.unitPrice * it.quantity).toFixed(2));
    totalAmount += lineTotal;

    const linePayload: Partial<InvoiceLineItem> = {
      description: it.description,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      lineTotal,
      invoiceId: invoice.id,
      companyId: company.id,
    };

    const line = itemRepo.create(linePayload);
    await itemRepo.save(line);
  }

  // 6) Update invoice total
  invoice.totalAmount = Number(totalAmount.toFixed(2));
  await invoiceRepo.save(invoice);

  // 7) Payment
  const paymentPayload: Partial<Payment> = {
    invoiceId: invoice.id,
    amount: invoice.totalAmount,
    paidAt: new Date(),
    method: 'CASH',
    companyId: company.id,
    createdBy: owner.id, // column is string uuid (nullable)
  };

  const payment = paymentRepo.create(paymentPayload);
  await paymentRepo.save(payment);

  console.log(
    `[seed-invoices-payments] Invoice ${invoice.invoiceNumber} created with ${itemsToAdd.length} items, payment recorded, company ${company.id}.`,
  );

  await ds.destroy();
  console.log('[seed-invoices-payments] datasource destroyed');
}

// Run directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('[seed-invoices-payments] process exiting with 0');
      process.exit(0);
    })
    .catch((rawErr) => {
      const errMessage =
        rawErr instanceof Error
          ? (rawErr.stack ?? rawErr.message)
          : String(rawErr);
      console.error('[seed-invoices-payments] Unhandled error:', errMessage);
      if (AppDataSource.isInitialized) {
        AppDataSource.destroy().catch(() => {});
      }
      process.exit(1);
    });
}
