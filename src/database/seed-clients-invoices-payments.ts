// File: src/database/seed-clients-invoices-payments.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Client, ClientStatus } from '../crm/client/entities/client.entity';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { User } from '../entities/user.entity';

async function seed() {
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const clientRepo = AppDataSource.getRepository(Client);
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const itemRepo = AppDataSource.getRepository(InvoiceLineItem);
  const paymentRepo = AppDataSource.getRepository(Payment);

  try {
    // Pick an existing user to own the clients
    const owner = await userRepo.findOne({ where: {} });
    if (!owner) throw new Error('No users found — seed users first.');

    console.log(`Using owner: ${owner.id}`);

    // Create new clients
    const newClientsData = [
      {
        name: 'Charlie Parker',
        company: 'JazzTech Solutions',
        title: 'CEO',
        email: 'charlie.parker@example.com',
        phone: '+91-9988776655',
        status: ClientStatus.ACTIVE,
        ownerId: owner.id,
      },
      {
        name: 'Diana Prince',
        company: 'Amazon Analytics',
        title: 'Data Lead',
        email: 'diana.prince@example.com',
        phone: '+91-8877665544',
        status: ClientStatus.PROSPECT,
        ownerId: owner.id,
      },
      {
        name: 'Ethan Hunt',
        company: 'IMF Systems',
        title: 'Ops Manager',
        email: 'ethan.hunt@example.com',
        phone: '+91-7766554433',
        status: ClientStatus.ACTIVE,
        ownerId: owner.id,
      },
    ];

    const clients: Client[] = [];
    for (const c of newClientsData) {
      let existing = await clientRepo.findOne({
        where: { email: c.email, ownerId: c.ownerId },
      });
      if (!existing) {
        existing = await clientRepo.save(c);
        console.log(`Inserted client: ${existing.name} (${existing.id})`);
      } else {
        console.log(`Using existing client: ${existing.name}`);
      }
      clients.push(existing);
    }

    // Helper function to make random line items
    function randomLineItems() {
      const products = [
        'Product Alpha',
        'Product Beta',
        'Product Gamma',
        'Product Delta',
        'Product Omega',
      ];
      const count = Math.floor(Math.random() * 3) + 1; // 1–3 items
      const items: Partial<InvoiceLineItem>[] = [];

      for (let i = 0; i < count; i++) {
        const description =
          products[Math.floor(Math.random() * products.length)];
        const unitPrice = (Math.floor(Math.random() * 200) + 50).toFixed(2);
        const quantity = Math.floor(Math.random() * 5) + 1;
        const lineTotal = (parseFloat(unitPrice) * quantity).toFixed(2);

        items.push({
          description,
          unitPrice,
          quantity,
          lineTotal,
        });
      }

      return items;
    }

    // Generate invoices for each new client
    for (const client of clients) {
      const invoiceCount = Math.floor(Math.random() * 3) + 1; // 1–3 invoices
      for (let i = 0; i < invoiceCount; i++) {
        const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const statusOptions: Invoice['status'][] = [
          'draft',
          'issued',
          'paid',
          'cancelled',
        ];
        const status =
          statusOptions[Math.floor(Math.random() * statusOptions.length)];

        // Create invoice with temporary totalAmount=0
        let invoice = invoiceRepo.create({
          invoiceNumber,
          clientId: client.id,
          totalAmount: 0,
          status,
        });
        invoice = await invoiceRepo.save(invoice);

        // Create line items
        const itemsData = randomLineItems();
        let totalAmount = 0;
        for (const item of itemsData) {
          totalAmount += parseFloat(item.lineTotal!);
          await itemRepo.save({
            ...item,
            invoiceId: invoice.id,
          });
        }

        // Update invoice with real total
        invoice.totalAmount = parseFloat(totalAmount.toFixed(2));
        await invoiceRepo.save(invoice);

        // Add payment if paid
        if (status === 'paid') {
          const paidAmount =
            Math.random() > 0.3
              ? invoice.totalAmount // full payment 70% of time
              : parseFloat((invoice.totalAmount * 0.5).toFixed(2)); // partial
          await paymentRepo.save({
            invoiceId: invoice.id,
            amount: paidAmount,
            paidAt: new Date(),
            method: Math.random() > 0.5 ? 'CASH' : 'CARD',
          });
        }

        console.log(
          `Created invoice ${invoice.invoiceNumber} for client ${client.name} with status ${status} and total ${invoice.totalAmount}`,
        );
      }
    }

    console.log('✅ Clients + Invoices + Payments seed complete.');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
