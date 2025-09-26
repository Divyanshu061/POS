// src/inventory/transaction/transaction.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

  async create(
    dto: CreateTransactionDto,
    companyId: string,
  ): Promise<Transaction> {
    const tx = this.repo.create({
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: dto.type,
      quantity: dto.quantity,
      reference: dto.reference,
      companyId, // ✅ now passed as argument
    });
    return this.repo.save(tx);
  }

  findAll(companyId: string, skip = 0, take = 50): Promise<Transaction[]> {
    return this.repo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  // Get single transaction, scoped by company
  async findOne(id: string, companyId: string): Promise<Transaction> {
    const tx = await this.repo.findOne({ where: { id, companyId } });
    if (!tx)
      throw new NotFoundException(
        `Transaction ${id} not found for your company`,
      );
    return tx;
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
    companyId: string,
  ): Promise<Transaction> {
    const tx = await this.findOne(id, companyId);
    Object.assign(tx, dto);
    return this.repo.save(tx);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const result = await this.repo.delete({ id, companyId });
    if (!result.affected)
      throw new NotFoundException(
        `Transaction ${id} not found for your company`,
      );
  }
}
