import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';

import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  /**
   * Utility to safely parse numeric ID
   */
  private parseId(id: string, label = 'ID'): number {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed)) {
      throw new BadRequestException(`Invalid ${label}: ${id}`);
    }
    return parsed;
  }

  /**
   * Create a new product for a specific company
   */
  async create(companyId: string, dto: CreateProductDto): Promise<Product> {
    const product = this.repo.create({
      ...dto,
      company: { id: companyId }, // Properly links relation
    });

    const saved = await this.repo.save(product);
    this.logger.log(`Product created: ${saved.id} (Company: ${companyId})`);
    return saved;
  }

  /**
   * List all products for a given company, with optional pagination
   */
  async findAll(
    companyId: string,
    options?: { skip?: number; take?: number },
  ): Promise<Product[]> {
    const findOpts: FindManyOptions<Product> = {
      where: {
        company: { id: companyId },
      },
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    };

    return this.repo.find(findOpts);
  }

  /**
   * Fetch one product by company + ID
   */
  async findOne(companyId: string, id: string): Promise<Product> {
    const productId = this.parseId(id, 'product ID');

    const product = await this.repo.findOne({
      where: {
        company: { id: companyId },
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );
    }

    return product;
  }

  /**
   * Update a product by company + ID
   */
  async update(
    companyId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const productId = this.parseId(id, 'product ID');

    // Ensure the product exists
    await this.findOne(companyId, id);

    await this.repo.update(
      {
        company: { id: companyId },
        id: productId,
      },
      dto,
    );

    const updated = await this.findOne(companyId, id);
    this.logger.log(`Product updated: ${updated.id} (Company: ${companyId})`);
    return updated;
  }

  /**
   * Delete a product by company + ID
   */
  async remove(companyId: string, id: string): Promise<void> {
    const productId = this.parseId(id, 'product ID');

    const result = await this.repo.delete({
      company: { id: companyId },
      id: productId,
    });

    if (!result.affected) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );
    }

    this.logger.warn(`Product deleted: ${productId} (Company: ${companyId})`);
  }
}
