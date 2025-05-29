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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';

@Controller('inventory/purchases')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get()
  @Roles('admin', 'store_manager')
  findAll(@Query('companyId') companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'store_manager')
  create(@Body() dto: CreatePurchaseDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
