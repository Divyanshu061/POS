// src/payment-invoice/invoice.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Client } from '../crm/client/entities/client.entity';
import { InvoiceStatus } from './enums/invoice-status.enum';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create an invoice within a transaction after validating the client belongs to the company.
   */
  async create(
    companyId: string,
    dto: CreateInvoiceDto,
    userId: string,
  ): Promise<Invoice> {
    // Ensure client exists and belongs to the company
    const client = await this.clientRepo.findOne({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }
    if (client.companyId !== companyId) {
      throw new BadRequestException(
        'Client does not belong to the current company',
      );
    }

    // Transactional create - keep it small now; extend to include items if dto includes them
    return await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Invoice);

      const invoiceNumber = `INV-${Date.now()}`;

      const invoice = repo.create({
        invoiceNumber,
        clientId: dto.clientId,
        totalAmount: Number(dto.totalAmount ?? 0),
        status: dto.status ?? InvoiceStatus.DRAFT,
        companyId,
        createdBy: userId,
      });

      const saved = await repo.save(invoice);

      if (dto.items && dto.items.length > 0) {
        const itemRepo = manager.getRepository(InvoiceLineItem);

        const itemsToCreate = dto.items.map((it) =>
          itemRepo.create({
            invoiceId: saved.id,
            companyId,
            description: String(it.description ?? ''),
            unitPrice: Number(it.unitPrice ?? 0),
            quantity: Number(it.quantity ?? 1),
            lineTotal: Number(
              (
                Number(it.unitPrice ?? 0) * Number(it.quantity ?? 1) || 0
              ).toFixed(2),
            ),
          }),
        );

        await itemRepo.save(itemsToCreate);
      }
      // findOneOrFail to assert non-null result and satisfy TS
      return await repo.findOneOrFail({
        where: { id: saved.id },
        relations: ['client', 'payments', 'items'],
      });
    });
  }

  async findAll(companyId: string): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { companyId }, // 🔑 scope by company
      relations: ['client', 'payments'],
    });
  }

  async findOne(companyId: string, id: string): Promise<Invoice> {
    const inv = await this.invoiceRepo.findOne({
      where: { id, companyId }, // 🔑 ensure tenant isolation
      relations: ['client', 'payments', 'items'],
    });

    if (!inv) {
      throw new NotFoundException(`Invoice ${id} not found for this company`);
    }
    return inv;
  }
}
