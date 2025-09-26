import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
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
    private readonly audit: AuditLogService,
  ) {}

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
    } catch (err) {
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
    } catch (err) {
      this.logger.error(`Failed to update category ${id}`, err as Error);
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  /** Remove a category within the company */
  async remove(companyId: string, id: string, userId?: string): Promise<void> {
    const res = await this.repo.delete({ id, companyId });
    if (!res.affected) throw new NotFoundException(`Category ${id} not found`);
    try {
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
    } catch (err) {
      // audit failure shouldn't block deletion; log and continue
      this.logger.warn('Failed to write audit log for delete', err as Error);
    }
  }
}
