import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierContact } from './entities/supplier-contact.entity';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';
import { SupplierService } from './supplier.service';

@Injectable()
export class SupplierContactService {
  constructor(
    @InjectRepository(SupplierContact)
    private readonly repo: Repository<SupplierContact>,
    private readonly supplierSvc: SupplierService, // to validate supplier + company scoping
  ) {}

  async list(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierContact[]> {
    // ensure supplier belongs to company (will throw if not found)
    await this.supplierSvc.findOne(supplierId, companyId);
    return this.repo.find({
      where: { supplier: { id: supplierId } },
      relations: ['supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    supplierId: string,
    dto: CreateSupplierContactDto,
    companyId: string,
  ): Promise<SupplierContact> {
    // validate supplier & tenant
    await this.supplierSvc.findOne(supplierId, companyId);

    const contact = this.repo.create({
      ...dto,
      supplierId,
    } as Partial<SupplierContact>);

    // if isPrimary set, consider unsetting other primaries (simple approach)
    if (contact.isPrimary) {
      await this.repo.update({ supplierId }, { isPrimary: false });
      contact.isPrimary = true;
    }

    return this.repo.save(contact);
  }

  private async ensureContactForSupplier(
    contactId: string,
    supplierId: string,
    companyId: string,
  ) {
    const contact = await this.repo.findOne({
      where: { id: contactId },
      relations: ['supplier'],
    });

    if (!contact) {
      throw new NotFoundException(`Contact ${contactId} not found`);
    }
    if (!contact.supplier || contact.supplier.id !== supplierId) {
      throw new NotFoundException(
        `Contact ${contactId} does not belong to supplier ${supplierId}`,
      );
    }
    // verify supplier belongs to company
    const supplier = await this.supplierSvc.findOne(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(
        `Supplier ${supplierId} not found for this company`,
      );
    }
    return contact;
  }

  async update(
    supplierId: string,
    contactId: string,
    dto: UpdateSupplierContactDto,
    companyId: string,
  ): Promise<SupplierContact> {
    const contact = await this.ensureContactForSupplier(
      contactId,
      supplierId,
      companyId,
    );
    Object.assign(contact, dto);

    if (dto.isPrimary) {
      // unset other primaries
      await this.repo.update({ supplierId }, { isPrimary: false });
      contact.isPrimary = true;
    }

    return this.repo.save(contact);
  }

  async remove(
    supplierId: string,
    contactId: string,
    companyId: string,
  ): Promise<void> {
    const contact = await this.ensureContactForSupplier(
      contactId,
      supplierId,
      companyId,
    );
    await this.repo.remove(contact);
  }
}
