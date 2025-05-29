import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  create(dto: CreateCategoryDto): Promise<Category> {
    const c = this.repo.create(dto);
    return this.repo.save(c);
  }

  findAll(companyId: string): Promise<Category[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string): Promise<Category> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Category ${id} not found`);
    return c;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
