// src/crm/tag/tag.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);

  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  // Narrowing helper for safe companyId access.
  private hasCompanyId(obj: unknown): obj is { companyId?: string | null } {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'companyId' in (obj as Record<string, unknown>) &&
      ((obj as Record<string, unknown>)['companyId'] === null ||
        typeof (obj as Record<string, unknown>)['companyId'] === 'string')
    );
  }

  async create(dto: CreateTagDto, companyId?: string): Promise<Tag> {
    const tag = this.tagRepo.create({
      ...dto,
      companyId: companyId ?? null,
    } as Partial<Tag>);

    try {
      return await this.tagRepo.save(tag);
    } catch (err: unknown) {
      this.logger.warn('Tag creation failed', this.getErrorMessage(err));
      throw new BadRequestException(this.getErrorMessage(err));
    }
  }

  findAll(companyId?: string): Promise<Tag[]> {
    if (companyId) {
      // return tenant tags plus global tags (company_id IS NULL)
      return this.tagRepo.find({
        where: [{ companyId }, { companyId: IsNull() }],
        order: { name: 'ASC' },
      });
    }
    return this.tagRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string, companyId?: string): Promise<Tag> {
    let tag: Tag | null;

    if (companyId) {
      tag = await this.tagRepo.findOne({
        where: [
          { id, companyId },
          { id, companyId: IsNull() },
        ],
      });
    } else {
      tag = await this.tagRepo.findOneBy({ id });
    }

    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return tag;
  }

  /**
   * Update a tag — scoped by company. Company cannot update another company's tags.
   * We perform runtime narrowing and explicit field updates to satisfy the linter.
   */
  async update(
    id: string,
    dto: UpdateTagDto,
    companyId?: string,
  ): Promise<Tag> {
    const tag = await this.findOne(id, companyId);

    // Prevent tenant from updating another tenant's tag
    if (tag.companyId && companyId && tag.companyId !== companyId) {
      throw new ForbiddenException('Cannot modify tag from another company');
    }

    // If DTO tries to set companyId, validate that caller isn't changing ownership.
    if (this.hasCompanyId(dto)) {
      const newCompanyId = dto.companyId;
      if (companyId && newCompanyId && newCompanyId !== companyId) {
        throw new ForbiddenException('Cannot change tag company ownership');
      }
      // If newCompanyId is null/undefined or equals companyId it's allowed; we'll assign below if present
    }

    // Explicitly and safely assign allowed fields rather than Object.assign(tag, dto)
    if ('name' in dto && typeof dto.name === 'string') {
      tag.name = dto.name;
    }

    if (this.hasCompanyId(dto)) {
      // dto.companyId is now narrowed to string | null | undefined
      if (typeof dto.companyId === 'string') {
        tag.companyId = dto.companyId;
      } else if (dto.companyId === null) {
        tag.companyId = null;
      }
      // if undefined -> leave as-is
    }

    try {
      return await this.tagRepo.save(tag);
    } catch (err: unknown) {
      this.logger.warn('Tag update failed', this.getErrorMessage(err));
      throw new BadRequestException(this.getErrorMessage(err));
    }
  }

  async remove(id: string, companyId?: string): Promise<void> {
    const tag = await this.findOne(id, companyId);

    if (tag.companyId && companyId && tag.companyId !== companyId) {
      throw new ForbiddenException('Cannot remove tag from another company');
    }

    const res = await this.tagRepo.delete({ id });
    if (!res.affected) throw new NotFoundException(`Tag ${id} not found`);
  }
}
