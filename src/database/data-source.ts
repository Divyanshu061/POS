// src/database/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';

// ─── IMPORT ONLY THE ENTITIES YOU HAVE ────────────────────────────────────

// StockLevel module
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';

// Product module
import { Product } from '../inventory/product/entities/product.entity';

// Supplier module (new! required by Product)
import { Supplier } from '../inventory/supplier/entities/supplier.entity';

// Warehouse module
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';

// Company module
import { Company } from '../inventory/company/entities/company.entity';

// Category module
import { Category } from '../inventory/category/entities/category.entity';

// Purchase module
import { Purchase } from '../inventory/purchase/entities/purchase.entity';

// Sales module (Sale entity)
import { Sale } from '../inventory/sales/entities/sale.entity';

// Audit-Log module (if you have an audit-log.entity.ts)
import { AuditLog } from '../inventory/audit-log/entities/audit-log.entity';

// Transaction module (needed because Warehouse or StockLevel refer to it)
import { Transaction } from '../inventory/transaction/entities/transaction.entity';

// ────────────────────────────────────────────────────────────────────────────

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST, // e.g., "localhost"
  port: parseInt(process.env.DB_PORT || '5432', 10), // default: 5432
  username: process.env.DB_USERNAME, // e.g., "postgres"
  password: process.env.DB_PASSWORD, // your DB password
  database: process.env.DB_NAME, // e.g., "pos_system"

  synchronize: false, // NEVER set to true in production
  logging: true, // you can toggle off for production

  // ─── LIST ONLY THE EXISTING ENTITIES HERE ─────────────────────────────────
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
    // …add any other entity classes you actually have…
  ],

  // ─── POINT TO YOUR MIGRATIONS DIRECTORY ───────────────────────────────────
  migrations: ['src/migrations/*.ts'],
});
