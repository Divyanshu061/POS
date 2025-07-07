// src/crm/crm.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from './client/entities/client.entity';
import { Tag } from './tag/entities/tag.entity';

import { ClientService } from './client/client.service';
import { ClientController } from './client/client.controller';

import { TagModule } from './tag/tag.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Tag]),
    TagModule, // bring in TagService
  ],
  providers: [ClientService], // your existing service
  controllers: [ClientController],
})
export class CrmModule {}
