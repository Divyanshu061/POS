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

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const tx = this.repo.create({
      companyId: dto.companyId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: dto.type,
      quantity: dto.quantity,
      reference: dto.reference,
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

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.repo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const tx = await this.findOne(id);
    if (dto.type !== undefined) tx.type = dto.type;
    if (dto.quantity !== undefined) tx.quantity = dto.quantity;
    if ('reference' in dto) tx.reference = dto.reference!;
    return this.repo.save(tx);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected)
      throw new NotFoundException(`Transaction ${id} not found`);
  }
}
