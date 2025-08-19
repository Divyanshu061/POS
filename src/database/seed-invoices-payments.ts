// File: src/database/seed-invoices-payments.ts

import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { Client } from '../crm/client/entities/client.entity';

async function seed() {
  await AppDataSource.initialize();

  const clientRepo = AppDataSource.getRepository(Client);
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const lineItemRepo = AppDataSource.getRepository(InvoiceLineItem);
  const paymentRepo = AppDataSource.getRepository(Payment);

  try {
    // 1) Get a client
    const client = await clientRepo.findOne({ where: {} });
    if (!client) throw new Error('No client found — seed clients first.');

    // 2) Create invoice
    const invoice = invoiceRepo.create({
      invoiceNumber: `INV-${Date.now()}`,
      clientId: client.id,
      totalAmount: 0, // will update after adding items
      status: 'issued',
    });
    await invoiceRepo.save(invoice);

    // 3) Create line items
    const items = [
      { description: 'Product A', unitPrice: '50.00', quantity: 2 },
      { description: 'Product B', unitPrice: '80.00', quantity: 1 },
    ];

    let totalAmount = 0;
    for (const i of items) {
      const lineTotal = (parseFloat(i.unitPrice) * i.quantity).toFixed(2);
      totalAmount += parseFloat(lineTotal);

      const lineItem = lineItemRepo.create({
        description: i.description,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal,
        invoiceId: invoice.id,
      });
      await lineItemRepo.save(lineItem);
    }

    // 4) Update invoice total
    invoice.totalAmount = totalAmount;
    await invoiceRepo.save(invoice);

    // 5) Create payment
    const payment = paymentRepo.create({
      amount: totalAmount,
      paidAt: new Date(),
      method: 'CASH',
      invoice: invoice,
    });
    await paymentRepo.save(payment);

    console.log(
      `✅ Invoice ${invoice.invoiceNumber} with ${items.length} items and payment created.`,
    );
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((e) => {
  console.error('Unhandled seed error:', e);
  process.exit(1);
});
