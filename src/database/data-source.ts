import 'dotenv/config';
import { DataSource } from 'typeorm';

// ─── INVENTORY MODULE ────────────────────────────────────────────────
import { AuditLog } from '../inventory/audit-log/entities/audit-log.entity';
import { Category } from '../inventory/category/entities/category.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { Purchase } from '../inventory/purchase/entities/purchase.entity';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { SaleItem } from '../inventory/sales/entities/sale-item.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Transaction } from '../inventory/transaction/entities/transaction.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';

// ─── PURCHASE ORDER MODULE ───────────────────────────────────────────
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';

// ─── USER MODULE ─────────────────────────────────────────────────────
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

// ─── CRM MODULE ──────────────────────────────────────────────────────
import { Client } from '../crm/client/entities/client.entity';
import { Tag } from '../crm/tag/entities/tag.entity';

// ─── REPORTING MODULE ────────────────────────────────────────────────
import { ReportDefinition } from '../reporting/entities/report-definition.entity';
import { ReportRun } from '../reporting/entities/report-run.entity';
import { Dashboard } from '../reporting/entities/dashboard.entity';
import { DashboardWidget } from '../reporting/entities/dashboard-widget.entity';

// ─── PAYMENT & INVOICE MODULE ────────────────────────────────────────
import { Invoice } from '../payment-invoice/entities/invoice.entity';
import { Payment } from '../payment-invoice/entities/payment.entity';
import { InvoiceLineItem } from '../payment-invoice/entities/invoice-line-item.entity';

// ─── DATA SOURCE CONFIG ──────────────────────────────────────────────
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  synchronize: false, // Always false in production; use migrations instead
  logging: true,

  entities: [
    // Inventory
    AuditLog,
    Category,
    Company,
    Product,
    Purchase,
    Sale,
    SaleItem, // <- ✅ Important!
    StockLevel,
    Supplier,
    Transaction,
    Warehouse,

    // Purchase Order
    PurchaseOrder,
    PurchaseOrderItem,

    // User & Access Control
    User,
    Role,
    Permission,

    // CRM
    Client,
    Tag,

    // Reporting
    ReportDefinition,
    ReportRun,
    Dashboard,
    DashboardWidget,

    // Payment & Invoice
    Invoice,
    Payment,
    InvoiceLineItem,
  ],

  migrations: ['src/migrations/*.ts'],
});
