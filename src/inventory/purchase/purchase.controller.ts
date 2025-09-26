// src/inventory/purchase/purchase.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';

@Controller('inventory/purchases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get()
  @Roles('admin', 'store_manager')
  findAll(@CurrentCompany() companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager')
  findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.svc.create(companyId, dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.svc.update(companyId, id, dto, userId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine userId from token');
    return this.svc.remove(companyId, id, userId);
  }
}
