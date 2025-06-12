import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { Product } from '../product/entities/product.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(dto: CreatePurchaseDto): Promise<Purchase> {
    const purchaseData: DeepPartial<Purchase> = {
      supplierId: dto.supplierId,
      productId: Number(dto.productId),
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      companyId: dto.companyId,
    };
    const purchase = this.purchaseRepo.create(purchaseData);
    const saved = await this.purchaseRepo.save(purchase);

    const product = await this.productRepo.findOne({
      where: { id: saved.productId },
    });
    if (!product)
      throw new NotFoundException(`Product ${saved.productId} not found`);

    if ((product.quantity || 0) < saved.quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${saved.productId}`,
      );
    }

    product.quantity = (product.quantity || 0) - saved.quantity;
    await this.productRepo.save(product);

    return saved;
  }

  findAll(companyId: string): Promise<Purchase[]> {
    return this.purchaseRepo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({ where: { id } });
    if (!purchase) throw new NotFoundException(`Purchase ${id} not found`);
    return purchase;
  }

  async update(id: string, dto: UpdatePurchaseDto): Promise<Purchase> {
    const existing = await this.findOne(id);
    const updateData: DeepPartial<Purchase> = {};
    if (dto.quantity !== undefined) updateData.quantity = dto.quantity;
    if (dto.unitCost !== undefined) updateData.unitCost = dto.unitCost;

    await this.purchaseRepo.update(id, updateData);
    const updated = await this.findOne(id);

    const diff = updated.quantity - existing.quantity;
    if (diff !== 0) {
      const product = await this.productRepo.findOne({
        where: { id: updated.productId },
      });
      if (!product)
        throw new NotFoundException(`Product ${updated.productId} not found`);

      if (diff > 0 && (product.quantity || 0) < diff) {
        throw new BadRequestException(
          `Insufficient stock to adjust by ${diff} units`,
        );
      }

      product.quantity = (product.quantity || 0) - diff;
      await this.productRepo.save(product);
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    const product = await this.productRepo.findOne({
      where: { id: existing.productId },
    });
    if (product) {
      product.quantity = (product.quantity || 0) + existing.quantity;
      await this.productRepo.save(product);
    }
    await this.purchaseRepo.delete(id);
  }
}
