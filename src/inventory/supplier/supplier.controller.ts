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
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierContactService } from './supplier-contact.service';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';

@Controller('inventory/suppliers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SupplierController {
  constructor(
    private readonly svc: SupplierService,
    private readonly contactSvc: SupplierContactService,
  ) {}

  @Get()
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findAll(@CurrentCompany() companyId: string) {
    return this.svc.findAll(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.findOne(id, companyId);
  }

  @Post()
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreateSupplierDto, @CurrentCompany() companyId: string) {
    return this.svc.create(dto, companyId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.update(id, dto, companyId);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.remove(id, companyId);
  }

  // ---------- Supplier Contacts (sub-resource) ----------

  @Get(':id/contacts')
  @Roles('admin', 'store_manager', 'warehouse_staff', 'sales_rep')
  listContacts(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.contactSvc.list(supplierId, companyId);
  }

  @Post(':id/contacts')
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  createContact(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateSupplierContactDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.contactSvc.create(supplierId, dto, companyId);
  }

  @Patch(':id/contacts/:contactId')
  @Roles('admin', 'store_manager')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updateContact(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateSupplierContactDto,
    @CurrentCompany() companyId: string,
  ) {
    return this.contactSvc.update(supplierId, contactId, dto, companyId);
  }

  @Delete(':id/contacts/:contactId')
  @Roles('admin')
  @HttpCode(204)
  removeContact(
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentCompany() companyId: string,
  ) {
    return this.contactSvc.remove(supplierId, contactId, companyId);
  }
}
