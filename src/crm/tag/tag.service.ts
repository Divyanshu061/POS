import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  async create(dto: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepo.create(dto);
    return this.tagRepo.save(tag);
  }

  findAll(): Promise<Tag[]> {
    return this.tagRepo.find();
  }

  async findOne(id: string): Promise<Tag> {
    // use findOneBy() to look up by primary column
    const tag = await this.tagRepo.findOneBy({ id });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
    return tag;
  }

  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    await this.tagRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.tagRepo.delete(id);
    if (!res.affected) throw new NotFoundException(`Tag ${id} not found`);
  }
}
