// src/inventory/reports/reports.service.ts

import { Injectable } from '@nestjs/common';
import { StockLevelService } from '../stock-level/stock-level.service';
import { PurchaseService } from '../purchase/purchase.service';
import { SalesService } from '../sales/sales.service';
import { StockLevel } from '../stock-level/entities/stock-level.entity';
import { Product } from '../product/entities/product.entity';
import { Purchase } from '../purchase/entities/purchase.entity';
import { Sale } from '../sales/entities/sale.entity';

// A low‐stock entry can be either a full StockLevel or a “fallback” with only Product info:
export type LowStockEntry = StockLevel | { product: Product; warehouse: null };

@Injectable()
export class ReportsService {
  constructor(
    private readonly stockSvc: StockLevelService,
    private readonly purchaseSvc: PurchaseService,
    private readonly salesSvc: SalesService,
  ) {}

  /**
   * Returns all StockLevels for a company at or below the threshold,
   * plus any Products whose own quantity is ≤ threshold (when no StockLevel exists).
   */
  async lowStockReport(
    companyId: string,
    threshold = 10,
  ): Promise<LowStockEntry[]> {
    return this.stockSvc.lowStockReport(companyId, threshold);
  }

  /**
   * Returns all Purchases for a company.
   */
  async purchaseReport(companyId: string): Promise<Purchase[]> {
    return this.purchaseSvc.findAll(companyId);
  }

  /**
   * Returns all Sales for a company.
   */
  async salesReport(companyId: string): Promise<Sale[]> {
    return this.salesSvc.findAll(companyId);
  }
}
