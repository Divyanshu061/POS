// src/database/seed-sales.ts
import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { SaleItem } from '../inventory/sales/entities/sale-item.entity';
import {
  Transaction,
  TransactionType,
} from '../inventory/transaction/entities/transaction.entity';
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { PaymentMethod } from '../inventory/sales/dto/create-sale.dto';

async function run() {
  await AppDataSource.initialize();

  const saleRepo = AppDataSource.getRepository(Sale);
  const transactionRepo = AppDataSource.getRepository(Transaction);
  const invoiceRepo = AppDataSource.getRepository(Invoice);
  const invoiceLineRepo = AppDataSource.getRepository(InvoiceLineItem);
  const paymentRepo = AppDataSource.getRepository(Payment);

  const warehouseId = 'd484f505-53ed-44bd-b1e6-a96598137012';
  const companyId = '421e0488-aa80-4ade-ad90-2b458b7e4de8';
  const clientId = '09b1e70e-e114-48bd-9031-27c225b1c3af';

  const itemsData = [
    { productId: 14, quantity: 5, unitPrice: 50 },
    { productId: 13, quantity: 2, unitPrice: 80 },
    { productId: 17, quantity: 3, unitPrice: 120 },
    { productId: 16, quantity: 1, unitPrice: 200 },
  ];

  const totalQuantity = itemsData.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = itemsData.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );

  // --- Create Sale ---
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
  await saleRepo.save(sale);

  // --- Create Transactions ---
  for (const i of itemsData) {
    const transaction = transactionRepo.create({
      companyId,
      productId: i.productId,
      warehouseId,
      type: TransactionType.OUT,
      quantity: i.quantity,
      reference: `Sale ${sale.id}`,
    });
    await transactionRepo.save(transaction);
  }

  // --- Create Invoice ---
  const invoice = invoiceRepo.create({
    invoiceNumber: `INV-${Date.now()}`,
    clientId,
    totalAmount,
    status: 'paid',
    items: [],
  });
  await invoiceRepo.save(invoice);

  // --- Create Invoice Line Items ---
  for (const i of itemsData) {
    const line = invoiceLineRepo.create({
      description: `Product ${i.productId}`,
      unitPrice: i.unitPrice.toFixed(2),
      quantity: i.quantity,
      lineTotal: (i.unitPrice * i.quantity).toFixed(2),
      invoiceId: invoice.id,
    });
    await invoiceLineRepo.save(line);
  }

  // --- Create Payment ---
  const payment = paymentRepo.create({
    invoice,
    amount: totalAmount,
    paidAt: new Date(),
    method: 'CASH',
  });
  await paymentRepo.save(payment);

  console.log(
    '✅ Seed completed: Sale, Transactions, Invoice, Payment created',
  );
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
