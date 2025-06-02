// src/inventory/product/product.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  DeepPartial,
} from 'typeorm';

import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateAuditLogDto } from '../audit-log/dto/create-audit-log.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    private readonly audit: AuditLogService,
  ) {}

  private buildCompanyWhere(companyId: string): FindOptionsWhere<Product> {
    return { companyId };
  }

  private parseNumericId(value: string, label = 'ID'): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`Invalid ${label}: ${value}`);
    }
    return parsed;
  }

  private mapDtoToEntity(
    dto: CreateProductDto | UpdateProductDto,
  ): DeepPartial<Product> {
    const partial: DeepPartial<Product> = {};
    if ('name' in dto && dto.name !== undefined) partial.name = dto.name;
    if ('sku' in dto && dto.sku !== undefined) partial.sku = dto.sku;
    if ('barcode' in dto) partial.barcode = dto.barcode;
    if ('description' in dto) partial.description = dto.description;
    if ('unitPrice' in dto && dto.unitPrice !== undefined)
      partial.unitPrice = dto.unitPrice;

    if ('categoryId' in dto && dto.categoryId !== undefined) {
      partial.categoryId = String(dto.categoryId);
    }
    if ('supplierId' in dto && dto.supplierId !== undefined) {
      partial.supplierId = String(dto.supplierId);
    }

    return partial;
  }

  private async generateUniqueBarcode(): Promise<string> {
    let barcode: string;
    let isUnique = false;

    do {
      barcode = this.generateBarcode();
      const existing = await this.repo.findOne({ where: { barcode } });
      if (!existing) {
        isUnique = true;
      }
    } while (!isUnique);

    return barcode;
  }

  private generateBarcode(): string {
    return Math.floor(Math.random() * 1_000_000_000_000)
      .toString()
      .padStart(12, '0');
  }

  /** Create a new product for a specific company */
  async create(
    companyId: string,
    dto: CreateProductDto,
    userId?: string, // userId is optional, but if passed, must be UUID
  ): Promise<Product> {
    if (!dto.barcode) {
      dto.barcode = await this.generateUniqueBarcode();
    }
    const base = { companyId };
    const entity = this.repo.create({ ...base, ...this.mapDtoToEntity(dto) });

    try {
      const saved = await this.repo.save(entity);
      this.logger.log(`Product created: ${saved.id} (Company: ${companyId})`);

      // Only log if a valid userId (UUID) was provided
      if (userId) {
        await this.audit.log({
          action: 'CREATE',
          entity: 'product',
          entityId: String(saved.id),
          userId, // this must be a real UUID
          changes: saved,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to create product: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Unable to create product');
    }
  }

  /** List all products for a given company, with optional pagination */
  async findAll(
    companyId: string,
    options?: { skip?: number; take?: number },
  ): Promise<Product[]> {
    const opts: FindManyOptions<Product> = {
      where: this.buildCompanyWhere(companyId),
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
      relations: ['category', 'supplier'],
    };
    return this.repo.find(opts);
  }

  /** Fetch one product by company + ID */
  async findOne(companyId: string, id: string): Promise<Product> {
    const productId = this.parseNumericId(id, 'productId');
    const product = await this.repo.findOne({
      where: { ...this.buildCompanyWhere(companyId), id: productId },
      relations: ['category', 'supplier'],
    });
    if (!product) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}`,
      );
    }
    return product;
  }

  /** Update a product by company + ID */
  async update(
    companyId: string,
    id: string,
    dto: UpdateProductDto,
    userId?: string, // userId is optional
  ): Promise<Product> {
    const productId = this.parseNumericId(id, 'productId');
    await this.findOne(companyId, id);

    try {
      await this.repo.update(
        { ...this.buildCompanyWhere(companyId), id: productId },
        this.mapDtoToEntity(dto),
      );
      const updated = await this.findOne(companyId, id);
      this.logger.log(`Product updated: ${updated.id}`);

      if (userId) {
        await this.audit.log({
          action: 'UPDATE',
          entity: 'product',
          entityId: String(updated.id),
          userId, // must be a real UUID
          changes: dto,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update product: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Unable to update product');
    }
  }

  /** Delete a product by company + ID */
  async remove(
    companyId: string,
    id: string,
    userId?: string, // userId is optional
  ): Promise<void> {
    const productId = this.parseNumericId(id, 'productId');
    try {
      const result = await this.repo.delete({
        ...this.buildCompanyWhere(companyId),
        id: productId,
      });
      if (!result.affected) {
        throw new NotFoundException(
          `Product ${productId} not found for company ${companyId}`,
        );
      }
      this.logger.log(`Product deleted: ${productId}`);

      if (userId) {
        await this.audit.log({
          action: 'DELETE',
          entity: 'product',
          entityId: String(productId),
          userId, // must be a real UUID
          changes: undefined,
          timestamp: new Date(),
        } as CreateAuditLogDto);
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(
        `Failed to delete product: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Unable to delete product');
    }
  }
}
