// src/inventory/category/category.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';

@Controller('inventory/categories')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CategoryController {
  constructor(private readonly svc: CategoryService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(@CurrentCompany() companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @Roles('admin', 'store_manager')
  create(
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body() dto: CreateCategoryDto,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.svc.create(companyId, dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body() dto: UpdateCategoryDto,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.svc.update(companyId, id, dto, userId);
  }

  @Get(':id/delete-check')
  @Roles('admin', 'store_manager')
  async deleteCheck(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.getDeleteCheck(companyId, id);
  }
  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Query('force') force?: string,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');

    const doForce = force === 'true' || force === '1';
    await this.svc.remove(companyId, id, userId, doForce);
    return { success: true };
  }
}
