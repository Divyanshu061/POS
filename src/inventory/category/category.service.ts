import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateAuditLogDto } from '../audit-log/dto/create-audit-log.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly audit: AuditLogService,
  ) {}

  // --- helper to safely read error.code without using `any` ---
  private getErrorCode(err: unknown): string | undefined {
    if (err && typeof err === 'object') {
      const maybe = err as Record<string, unknown>;
      const code = maybe['code'];
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }

  /** Create a category under the given company */
  async create(
    companyId: string,
    dto: CreateCategoryDto,
    userId?: string,
  ): Promise<Category> {
    const entity = this.repo.create({ ...dto, companyId });
    try {
      const saved = await this.repo.save(entity);

      // explicit audit entry (optional — subscriber also records events)
      if (userId) {
        await this.audit.log({
          action: 'CREATE',
          entity: 'category',
          entityId: saved.id,
          userId,
          companyId,
          changes: { after: saved },
        } as CreateAuditLogDto);
      }

      return saved;
    } catch (err: unknown) {
      // keep logging useful info
      this.logger.error('Failed to create category', err as Error);
      throw new InternalServerErrorException('Failed to create category');
    }
  }

  /** List categories scoped to company */
  findAll(companyId: string): Promise<Category[]> {
    return this.repo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Get one category, scoped to company */
  async findOne(companyId: string, id: string): Promise<Category> {
    const c = await this.repo.findOne({ where: { id, companyId } });
    if (!c) throw new NotFoundException(`Category ${id} not found`);
    return c;
  }

  /** Update a category within the company */
  async update(
    companyId: string,
    id: string,
    dto: UpdateCategoryDto,
    userId?: string,
  ): Promise<Category> {
    // ensure item belongs to company
    const existing = await this.findOne(companyId, id);

    try {
      await this.repo.update({ id, companyId }, dto as Partial<Category>);
      const updated = await this.findOne(companyId, id);
      if (userId) {
        await this.audit.log({
          action: 'UPDATE',
          entity: 'category',
          entityId: updated.id,
          userId,
          companyId,
          changes: { before: existing, after: updated },
        } as CreateAuditLogDto);
      }
      return updated;
    } catch (err: unknown) {
      this.logger.error(`Failed to update category ${id}`, err as Error);
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  /**
   * Return counts of blocking references so UI can warn user
   * GET /inventory/categories/:id/delete-check
   */
  async getDeleteCheck(
    companyId: string,
    id: string,
  ): Promise<{ childCount: number; productCount: number }> {
    // ensure existence
    const category = await this.repo.findOne({ where: { id, companyId } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);

    const childCount = await this.repo.count({
      where: { parentCategoryId: id, companyId },
    });
    const productCount = await this.productRepo.count({
      where: { categoryId: id, companyId },
    });

    return { childCount, productCount };
  }

  /**
   * Remove a category within the company
   * If force === false (default) and there are children/products -> reject with details.
   * If force === true -> neutralize references (set NULL) and delete inside a transaction.
   */
  async remove(
    companyId: string,
    id: string,
    userId?: string,
    force = false,
  ): Promise<void> {
    // make sure category exists
    const category = await this.repo.findOne({ where: { id, companyId } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);

    const childCount = await this.repo.count({
      where: { parentCategoryId: id, companyId },
    });
    const productCount = await this.productRepo.count({
      where: { categoryId: id, companyId },
    });

    if (!force && (childCount > 0 || productCount > 0)) {
      // signal client that deletion is blocked and provide counts for warning UI
      throw new BadRequestException({
        message: 'Category has dependent records. Confirm delete to proceed.',
        details: { childCount, productCount },
      });
    }

    try {
      // do changes inside a transaction
      await this.repo.manager.transaction(async (manager) => {
        const catRepo = manager.getRepository(Category);
        const prodRepo = manager.getRepository(Product);

        // neutralize products linking to this category (set to NULL)
        if (productCount > 0) {
          await prodRepo.update(
            { categoryId: id, companyId },
            { categoryId: null },
          );
        }

        // detach immediate children (set their parentCategoryId to NULL)
        if (childCount > 0) {
          await catRepo.update(
            { parentCategoryId: id, companyId },
            { parentCategoryId: null },
          );
        }

        // finally delete the category
        const delRes = await catRepo.delete({ id, companyId });
        if (!delRes.affected) {
          throw new NotFoundException(`Category ${id} not found`);
        }

        // audit log
        if (userId) {
          await this.audit.log({
            action: 'DELETE',
            entity: 'category',
            entityId: String(id),
            userId,
            companyId,
            changes: undefined,
          } as CreateAuditLogDto);
        }
      });
    } catch (err: unknown) {
      // better logging (if err is Error show message; otherwise stringify)
      const logDetail =
        err instanceof Error ? err.message : JSON.stringify(err);
      this.logger.error(`Failed to delete category ${id}`, logDetail);

      // If a DB FK still blocks, surface a clearer error
      if (this.getErrorCode(err) === '23503') {
        // PostgreSQL foreign key violation
        throw new BadRequestException(
          'Delete blocked by foreign key constraints. Consider force delete or remove dependent records first.',
        );
      }
      throw new InternalServerErrorException('Failed to delete category');
    }
  }
}
