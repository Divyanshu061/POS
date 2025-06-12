// src/inventory/stock-level/types.ts

import { StockLevel } from './entities/stock-level.entity';
import { Product } from '../product/entities/product.entity';

export type LowStockEntry = StockLevel | { product: Product; warehouse: null };
