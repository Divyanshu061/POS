// purchase-order.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { User } from '../entities/user.entity';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePurchaseOrderDto, @Req() req: Request) {
    // req.user is injected by JwtAuthGuard; cast via unknown to satisfy TS
    const authUser = req.user as unknown as User;
    return this.poService.createPurchaseOrder(dto, authUser);
  }
}
