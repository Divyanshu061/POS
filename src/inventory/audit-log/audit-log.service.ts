// src/inventory/audit-log/audit-log.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { CreateAuditLogDto } from './dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const entry = this.repo.create(dto);
    return this.repo.save(entry);
  }

  findAll(): Promise<AuditLog[]> {
    return this.repo.find({ order: { timestamp: 'DESC' } });
  }

  findByEntity(entity: string, entityId: string): Promise<AuditLog[]> {
    return this.repo.find({
      where: { entity, entityId },
      order: { timestamp: 'DESC' },
    });
  }
}
