// src/inventory/audit-log/audit-log.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

@Controller('inventory/audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditLogController {
  constructor(private readonly svc: AuditLogService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.svc.findAll();
  }

  @Get('by-entity')
  @Roles('admin')
  findByEntity(
    @Query('entity') entity: string,
    @Query('entityId') entityId: string,
  ) {
    return this.svc.findByEntity(entity, entityId);
  }
}
