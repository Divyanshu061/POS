// src/purchase-order/purchase-order.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
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
import { ApprovePurchaseOrderDto } from './dto/approve-purchase-order.dto';
import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto';
import { ListPurchaseOrdersQueryDto } from './dto/list-purchase-orders.query.dto';

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

  // list with optional filters: status, page, limit, q (search), supplierId, warehouseId
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query() query: ListPurchaseOrdersQueryDto,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.findAllWithFilters(query, currentCompanyId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string, @CurrentCompany() currentCompanyId: string) {
    return this.poService.findOne(id, currentCompanyId);
  }

  // approve PO (no body required, but we accept optional DTO for audit note)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseOrderDto,
    @CurrentUser() authUser: AuthenticatedUser,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.approvePurchaseOrder(
      id,
      dto,
      authUser,
      currentCompanyId,
    );
  }

  // cancel PO (optional reason)
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelPurchaseOrderDto,
    @CurrentUser() authUser: AuthenticatedUser,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.cancelPurchaseOrder(
      id,
      dto,
      authUser,
      currentCompanyId,
    );
  }

  // receive goods (already implemented)
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

  // delete PO (soft or hard depending on service implementation)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() authUser: AuthenticatedUser,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.deletePurchaseOrder(id, authUser, currentCompanyId);
  }

  // export / print PO (returns binary/pdf in real impl; here returns URL or blob)
  @Get(':id/export')
  @HttpCode(HttpStatus.OK)
  exportPdf(
    @Param('id') id: string,
    @CurrentCompany() currentCompanyId: string,
  ) {
    return this.poService.exportPurchaseOrderPdf(id, currentCompanyId);
  }
}
