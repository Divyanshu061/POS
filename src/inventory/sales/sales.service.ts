// src/inventory/sales/sales.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Sale } from './entities/sale.entity';
import { CreateSaleDto, UpdateSaleDto } from './dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly repo: Repository<Sale>,
  ) {}

  /**
   * Create a new Sale.
   * Notice we only spread known keys from the DTO into a fresh object,
   * so ESLint can verify we’re not injecting arbitrary fields.
   */
  create(dto: CreateSaleDto): Promise<Sale> {
    const { productId, quantity, unitPrice, companyId } = dto;
    const sale = this.repo.create({
      productId,
      quantity,
      unitPrice,
      companyId,
    });
    return this.repo.save(sale);
  }

  findAll(companyId: string): Promise<Sale[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.repo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  /**
   * Update an existing Sale.
   * Again, we build a fresh object of only the allowed properties.
   */
  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const { productId, quantity, unitPrice } = dto;
    // Only update the fields actually present in the DTO:
    await this.repo.update(id, { productId, quantity, unitPrice });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
