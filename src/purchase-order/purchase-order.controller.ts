import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { User } from '../entities/user.entity';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: Request) {
    const authUser = req.user as unknown as User;
    return this.poService.createPurchaseOrder(dto, authUser);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.poService.findAll();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string) {
    return this.poService.findOne(id);
  }

  @Patch(':id/receive')
  receiveGoods(
    @Param('id') id: string,
    @Body() receiveDto: ReceivePurchaseOrderDto,
    @CurrentUser() authUser: User,
  ) {
    return this.poService.receiveGoods(id, receiveDto, authUser);
  }
}
