// src/inventory/transaction/transaction.controller.ts

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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Controller('inventory/transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionController {
  constructor(private readonly svc: TransactionService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
  ) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'store_manager', 'warehouse_staff')
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTransactionDto,
    @Query('companyId', new ValidationPipe({ whitelist: true }))
    companyId: string,
  ) {
    return this.svc.create({ ...dto, companyId });
  }

  @Patch(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateTransactionDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
