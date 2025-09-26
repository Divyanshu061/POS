// src/inventory/sales/sales.controller.ts
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
import { CurrentUser } from '../../auth/decorators/current-user-id.decorator';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleDto } from './dto';

@Controller('inventory/sales')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  /**
   * List all sales for the current company (tenant).
   */
  @Get()
  @Roles('admin', 'store_manager', 'sales_rep')
  async findAll(@CurrentCompany() companyId: string) {
    return this.svc.findAll(companyId);
  }

  /**
   * Get a single sale by id, scoped to the current company.
   */
  @Get(':id')
  @Roles('admin', 'store_manager', 'sales_rep')
  async findOne(@Param('id') id: string, @CurrentCompany() companyId: string) {
    return this.svc.findOne(companyId, id);
  }

  /**
   * Create a sale for the current company. DTO is validated.
   */
  @Post()
  @Roles('admin', 'store_manager', 'sales_rep')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: { userId: string },
    @CurrentCompany() companyId: string,
  ) {
    if (!user || !user.userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.create(companyId, dto, user.userId);
  }

  /**
   * Update sale (scoped to company). DTO validated.
   */
  @Patch(':id')
  @Roles('admin', 'store_manager')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: { userId: string },
    @CurrentCompany() companyId: string,
  ) {
    if (!user || !user.userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.update(companyId, id, dto, user.userId);
  }

  /**
   * Delete sale (scoped to company).
   */
  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id') id: string,
    @CurrentCompany() companyId: string,
    @CurrentUser() user: { userId: string },
  ) {
    if (!user || !user.userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.remove(companyId, id, user.userId);
  }
}
