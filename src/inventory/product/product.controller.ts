// src/inventory/product/product.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';

import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('inventory/products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  @Get()
  @Roles('admin', 'store_manager', 'sales_rep')
  findAll(
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
  ) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'sales_rep')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
  ) {
    return this.svc.findOne(companyId, id.toString());
  }

  @Post()
  @Roles('admin', 'store_manager')
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateProductDto,
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.create(companyId, dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProductDto,
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.update(companyId, id.toString(), dto, userId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.remove(companyId, id.toString(), userId);
  }
}
