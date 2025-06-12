import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { Product } from '../product/entities/product.entity';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { TransactionService } from '../transaction/transaction.service';
import { TransactionType } from '../transaction/entities/transaction.entity';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly txService: TransactionService,
  ) {}

  /**
   * Create a new purchase, increase stock, and log a transaction.
   */
  async create(dto: CreatePurchaseDto): Promise<Purchase> {
    const purchase = this.purchaseRepo.create({
      supplierId: dto.supplierId,
      productId: dto.productId,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      companyId: dto.companyId,
    });

    const saved = await this.purchaseRepo.save(purchase);

    const product = await this.productRepo.findOne({
      where: { id: saved.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${saved.productId} not found`);
    }

    // ✅ Purchase adds stock (stock-IN)
    product.quantity = (product.quantity || 0) + saved.quantity;
    await this.productRepo.save(product);

    // Record stock-IN transaction
    await this.txService.create({
      productId: saved.productId,
      warehouseId: dto.warehouseId,
      type: TransactionType.IN,
      quantity: saved.quantity,
      reference: `Purchase#${saved.id}`,
      companyId: dto.companyId,
    });

    return saved;
  }

  /**
   * Retrieve all purchases for a company.
   */
  findAll(companyId: string): Promise<Purchase[]> {
    return this.purchaseRepo.find({ where: { companyId } });
  }

  /**
   * Retrieve a specific purchase by ID.
   */
  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepo.findOne({ where: { id } });
    if (!purchase) {
      throw new NotFoundException(`Purchase ${id} not found`);
    }
    return purchase;
  }

  /**
   * Update a purchase record and adjust stock accordingly.
   */
  async update(id: string, dto: UpdatePurchaseDto): Promise<Purchase> {
    const existing = await this.findOne(id);

    // Calculate quantity difference
    const newQuantity = dto.quantity ?? existing.quantity;
    const quantityDiff = newQuantity - existing.quantity;

    await this.purchaseRepo.update(id, {
      quantity: newQuantity,
      unitCost: dto.unitCost ?? existing.unitCost,
    });

    const updated = await this.findOne(id);

    const product = await this.productRepo.findOne({
      where: { id: updated.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${updated.productId} not found`);
    }

    // ✅ Adjust stock correctly
    product.quantity = (product.quantity || 0) + quantityDiff;
    if (product.quantity < 0) {
      throw new BadRequestException(
        `Product stock cannot go below zero. Current: ${product.quantity}, Adjustment: ${quantityDiff}`,
      );
    }

    await this.productRepo.save(product);

    return updated;
  }

  /**
   * Delete a purchase and reverse its stock effect.
   */
  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);

    const product = await this.productRepo.findOne({
      where: { id: existing.productId },
    });

    if (product) {
      // ✅ Remove purchase → remove stock
      product.quantity = (product.quantity || 0) - existing.quantity;
      if (product.quantity < 0) {
        throw new BadRequestException(
          `Product stock cannot go below zero after deletion.`,
        );
      }
      await this.productRepo.save(product);
    }

    await this.purchaseRepo.delete(id);
  }
}
