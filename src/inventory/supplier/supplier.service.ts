// src/inventory/supplier/supplier.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierContact } from './entities/supplier-contact.entity';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
    // removed unused contactRepo injection
  ) {}

  /**
   * Create supplier and optional contacts atomically.
   * If dto.contacts is provided it will create contact rows linked to the supplier
   * inside the same transaction.
   */
  async create(dto: CreateSupplierDto, companyId: string): Promise<Supplier> {
    // Validate business rules before writing
    if (Array.isArray(dto.contacts)) {
      // runtime-checked array; infer element type from DTO
      const primaryCount = dto.contacts.filter((c) => !!c.isPrimary).length;
      if (primaryCount > 1) {
        throw new BadRequestException(
          'Only one contact can be marked as primary',
        );
      }
    }

    // Use transaction to ensure atomic writes
    return this.repo.manager.transaction(async (manager) => {
      // create supplier entity
      const supplier = manager.create(Supplier, {
        name: dto.name,
        contactNumber: dto.contactNumber,
        email: dto.email,
        address: dto.address,
        companyId,
      });

      const savedSupplier = await manager.save(supplier);

      // create contacts if present
      if (Array.isArray(dto.contacts) && dto.contacts.length > 0) {
        const contacts = dto.contacts.map((c: CreateSupplierContactDto) =>
          manager.create(SupplierContact, {
            name: c.name,
            role: c.role,
            phone: c.phone,
            email: c.email,
            isPrimary: !!c.isPrimary,
            supplierId: savedSupplier.id,
          }),
        );

        await manager.save(contacts);
      }

      // load and return supplier with relations (guarantee non-null)
      const loaded = await manager.findOne(Supplier, {
        where: { id: savedSupplier.id },
        relations: ['company', 'contacts'],
      });

      if (!loaded) {
        // This should never happen, but make typesafe for TS and clearer errors
        throw new NotFoundException(
          `Failed to load supplier after save (id=${savedSupplier.id})`,
        );
      }

      return loaded;
    });
  }

  async findAll(companyId: string): Promise<Supplier[]> {
    return this.repo.find({
      where: { company: { id: companyId } },
      relations: ['company', 'contacts'], // include contacts for convenience
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, companyId: string): Promise<Supplier> {
    const supplier = await this.repo.findOne({
      where: { id, company: { id: companyId } },
      relations: ['company', 'contacts'], // include contacts by default
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier ${id} not found for this company`);
    }
    return supplier;
  }

  async update(
    id: string,
    dto: UpdateSupplierDto,
    companyId: string,
  ): Promise<Supplier> {
    const supplier = await this.findOne(id, companyId);

    // Prevent accidental multiple primaries if contacts can be updated here
    if (Array.isArray(dto.contacts)) {
      const primaries = dto.contacts.filter((c) => !!c.isPrimary);
      if (primaries.length > 1) {
        throw new BadRequestException(
          'Only one contact can be marked as primary',
        );
      }
      // NOTE: we intentionally do NOT automatically manage contact upserts here.
      // Use SupplierContactService to add/update/remove individual contacts,
      // or implement upsert logic here if you want bulk contact updates.
    }

    Object.assign(supplier, dto);
    return this.repo.save(supplier);
  }

  async remove(id: string, companyId: string): Promise<void> {
    const supplier = await this.findOne(id, companyId);
    await this.repo.remove(supplier);
  }
}
