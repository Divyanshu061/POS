import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly repo: Repository<Purchase>,
  ) {}

  create(dto: CreatePurchaseDto): Promise<Purchase> {
    // cast dto to DeepPartial so .create() accepts it without unsafe‐argument
    const entity = this.repo.create(dto as DeepPartial<Purchase>);
    return this.repo.save(entity);
  }

  findAll(companyId: string): Promise<Purchase[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Purchase> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Purchase ${id} not found`);
    return p;
  }

  async update(id: string, dto: UpdatePurchaseDto): Promise<Purchase> {
    await this.repo.update(id, dto as DeepPartial<Purchase>);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
