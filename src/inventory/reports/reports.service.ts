// src/inventory/reports/reports.service.ts

import { Injectable } from '@nestjs/common';
import { StockLevelService } from '../stock-level/stock-level.service';
import { PurchaseService } from '../purchase/purchase.service';
import { SalesService } from '../sales/sales.service';

import { StockLevel } from '../stock-level/entities/stock-level.entity';
import { Product } from '../product/entities/product.entity';
import { Purchase } from '../purchase/entities/purchase.entity';
import { Sale } from '../sales/entities/sale.entity';

export type LowStockEntry = StockLevel | { product: Product; warehouse: null };

@Injectable()
export class ReportsService {
  constructor(
    private readonly stockSvc: StockLevelService,
    private readonly purchaseSvc: PurchaseService,
    private readonly salesSvc: SalesService,
  ) {}

  async lowStockReport(
    companyId: string,
    threshold = 10,
  ): Promise<LowStockEntry[]> {
    return this.stockSvc.lowStockReport(companyId, threshold);
  }

  async purchaseReport(companyId: string): Promise<Purchase[]> {
    return this.purchaseSvc.findAll(companyId);
  }

  async salesReport(companyId: string): Promise<Sale[]> {
    return this.salesSvc.findAll(companyId);
  }
  async purchaseSummary(companyId: string) {
    const purchases = await this.purchaseSvc.findAll(companyId);

    const summary = new Map<
      number,
      { productId: number; totalQty: number; totalCost: number }
    >();

    for (const p of purchases) {
      const entry = summary.get(p.productId) || {
        productId: p.productId,
        totalQty: 0,
        totalCost: 0,
      };

      entry.totalQty += p.quantity;
      entry.totalCost += Number(p.unitCost) * p.quantity;

      summary.set(p.productId, entry);
    }

    return Array.from(summary.values());
  }
}
