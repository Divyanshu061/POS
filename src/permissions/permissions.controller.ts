// src/permissions/permissions.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { Permission } from '../entities/permission.entity';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permsSvc: PermissionsService) {}

  /** POST /permissions */
  @Post()
  create(@Body() dto: CreatePermissionDto): Promise<Permission> {
    return this.permsSvc.create(dto);
  }

  /** GET /permissions */
  @Get()
  // eslint-disable-next-line prettier/prettier
    findAll(): Promise<Permission[]> {
    return this.permsSvc.findAll();
  }

  /** GET /permissions/:id */
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Permission> {
    return this.permsSvc.findOne(id);
  }

  /** PATCH /permissions/:id */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: CreatePermissionDto,
  ): Promise<Permission> {
    return this.permsSvc.update(id, dto);
  }

  /** DELETE /permissions/:id */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.permsSvc.remove(id);
  }
}
