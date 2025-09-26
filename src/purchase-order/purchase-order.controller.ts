// src/purchase-order/purchase-order.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentCompany } from '../auth/decorators/current-company.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../auth/decorators/current-user-id.decorator';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() authUser: AuthenticatedUser,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.createPurchaseOrder(dto, authUser, currentCompanyId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(@CurrentCompany() currentCompanyId: string) {
    return this.poService.findAll(currentCompanyId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string, @CurrentCompany() currentCompanyId: string) {
    return this.poService.findOne(id, currentCompanyId);
  }

  @Patch(':id/receive')
  receiveGoods(
    @Param('id') id: string,
    @Body() receiveDto: ReceivePurchaseOrderDto,
    @CurrentUser() authUser: AuthenticatedUser,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.receiveGoods(
      id,
      receiveDto,
      authUser,
      currentCompanyId,
    );
  }
}
