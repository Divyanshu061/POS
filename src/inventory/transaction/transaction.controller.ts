// src/inventory/transaction/transaction.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';

@Controller('inventory/transactions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TransactionController {
  constructor(private readonly svc: TransactionService) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(
    @CurrentCompany() companyId: string,
    @Query('skip') skip = 0,
    @Query('take') take = 50,
  ) {
    return this.svc.findAll(companyId, Number(skip), Number(take));
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager', 'warehouse_staff')
  create(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateTransactionDto,
    @CurrentCompany() companyId: string, // get companyId from auth context
  ) {
    return this.svc.create(dto, companyId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateTransactionDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.update(id, dto, companyId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.remove(id, companyId);
  }
}
