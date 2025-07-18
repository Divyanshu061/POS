// File: src/database/data-source.ts

import 'dotenv/config';
import { DataSource } from 'typeorm';

// ─── INVENTORY MODULES ────────────────────────────────────────────────
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Company } from '../inventory/company/entities/company.entity';
import { Category } from '../inventory/category/entities/category.entity';
import { Purchase } from '../inventory/purchase/entities/purchase.entity';
import { Sale } from '../inventory/sales/entities/sale.entity';
import { AuditLog } from '../inventory/audit-log/entities/audit-log.entity';
import { Transaction } from '../inventory/transaction/entities/transaction.entity';

// ─── PURCHASE ORDER MODULE ─────────────────────────────────────────────
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';

// ─── USER ─────────────────────────────────────────────
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';

// ─── CRM ORDER MODULE ─────────────────────────────────────────────
import { Client } from '../crm/client/entities/client.entity';
import { Tag } from '../crm/tag/entities/tag.entity';

// ─── REPORTING MODULE ─────────────────────────────────────────────
import { ReportDefinition } from '../reporting/entities/report-definition.entity';
import { ReportRun } from '../reporting/entities/report-run.entity';
import { Dashboard } from '../reporting/entities/dashboard.entity';
import { DashboardWidget } from '../reporting/entities/dashboard-widget.entity';

// ──────────────────────────────────────────────────────────────────────
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  synchronize: false, // never true in production
  logging: true,

  entities: [
    StockLevel,
    Product,
    Supplier,
    Warehouse,
    Company,
    Category,
    Purchase,
    Sale,
    AuditLog,
    Transaction,
    PurchaseOrder,
    PurchaseOrderItem,
    User,
    Role,
    Permission,
    Client,
    Tag,
    // reporting
    ReportDefinition,
    ReportRun,
    Dashboard,
    DashboardWidget,
  ],

  migrations: ['src/migrations/*.ts'],
});
