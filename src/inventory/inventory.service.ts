import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockLevel } from './entities/stock-level.entity';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockLevel)
    private readonly _stockRepo: Repository<StockLevel>, // ← underscore prefix
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  async recordTransaction(dto: AdjustStockDto): Promise<Transaction> {
    try {
      const tx: Transaction = this.txRepo.create({
        product: { id: dto.productId },
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantity: dto.quantity,
        reference: dto.reference,
      });
      return await this.txRepo.save(tx);
    } catch {
      // catch without a binding, so no unused-var error
      throw new InternalServerErrorException('Failed to save transaction');
    }
  }
}
