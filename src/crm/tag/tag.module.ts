// src/crm/tag/tag.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { TagService } from './tag.service';
import { TagController } from './tag.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tag])],
  providers: [TagService],
  controllers: [TagController],
  exports: [
    // export the entire TypeOrmModule so that
    // other modules can get TagRepository injected
    TypeOrmModule,
  ],
})
export class TagModule {}
