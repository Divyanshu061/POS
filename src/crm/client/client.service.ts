// src/crm/client/client.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, QueryFailedError, In, DeepPartial } from 'typeorm';
import { Client } from './entities/client.entity';
import { Tag } from '../tag/entities/tag.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

// Adjust these import paths if your project places User/Company elsewhere
import { User } from '../../entities/user.entity';
import { Company } from '../../inventory/company/entities/company.entity';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  /**
   * Create client under the provided company and owner.
   */
  async create(
    dto: CreateClientDto,
    ownerId: string,
    companyId: string,
  ): Promise<Client> {
    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const tags =
      dto.tags && dto.tags.length
        ? await this.tagRepo.find({ where: { id: In(dto.tags) } })
        : [];

    const clientPayload: DeepPartial<Client> = {
      name: dto.name,
      title: dto.title,
      email: dto.email,
      phone: dto.phone,
      status: dto.status,
      tags,
      // set tenant explicitly
      company: { id: companyId } as DeepPartial<Company>,
      // set owner relation by id
      owner: { id: ownerId } as DeepPartial<User>,
    };

    const client = this.clientRepo.create(clientPayload);

    try {
      return await this.clientRepo.save(client);
    } catch (err: unknown) {
      // Narrow error safely
      let message: string = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === 'string') {
        message = err;
      }

      // If it's a QueryFailedError or DB index error → conflict
      if (
        err instanceof QueryFailedError ||
        message.includes('IDX_clients_owner_email')
      ) {
        throw new ConflictException(
          `A client with email "${dto.email}" already exists in this company.`,
        );
      }

      throw err;
    }
  }

  /**
   * List clients for a given owner + company (paginated).
   */
  async findAll(
    query: ListClientsDto,
    ownerId: string,
    companyId: string,
  ): Promise<{ data: Client[]; total: number }> {
    const { page, limit, status, search, createdFrom, createdTo, tag } = query;

    const qb = this.clientRepo
      .createQueryBuilder('client')
      .where('client.deletedAt IS NULL')
      .andWhere('client.ownerId = :ownerId', { ownerId })
      .andWhere('client.companyId = :companyId', { companyId })
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('client.status = :status', { status });
    }

    if (search) {
      qb.andWhere('(client.name ILIKE :s OR client.email ILIKE :s)', {
        s: `%${search}%`,
      });
    }

    if (createdFrom) {
      qb.andWhere('client.createdAt >= :from', { from: createdFrom });
    }

    if (createdTo) {
      qb.andWhere('client.createdAt <= :to', { to: createdTo });
    }

    if (tag) {
      qb.leftJoin('client.tags', 'tag').andWhere('tag.id = :tag', { tag });
    } else {
      qb.leftJoinAndSelect('client.tags', 'tag');
    }

    const [clients, total] = await qb.getManyAndCount();
    return { data: clients, total };
  }

  /**
   * Get single client scoped by owner + company.
   */
  async findOne(
    id: string,
    ownerId: string,
    companyId: string,
  ): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id, ownerId, companyId, deletedAt: IsNull() },
      relations: ['tags'],
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  /**
   * Update (full or partial) — tenant enforced.
   */
  async update(
    id: string,
    dto: UpdateClientDto,
    ownerId: string,
    companyId: string,
  ): Promise<Client> {
    const client = await this.findOne(id, ownerId, companyId);

    if (dto.tags) {
      client.tags =
        dto.tags && dto.tags.length
          ? await this.tagRepo.find({ where: { id: In(dto.tags) } })
          : [];
    }

    const rest = { ...dto } as Partial<Client>;
    delete rest.tags;
    Object.assign(client, rest);

    // Ensure client stays under same tenant
    client.companyId = companyId;

    return this.clientRepo.save(client);
  }

  /**
   * Soft delete scoped by owner + company.
   */
  async remove(id: string, ownerId: string, companyId: string): Promise<void> {
    const result = await this.clientRepo.softDelete({
      id,
      ownerId,
      companyId,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`Client ${id} not found`);
    }
  }
}
