//src/crm/client/client.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, QueryFailedError } from 'typeorm';
import { Client } from './entities/client.entity';
import { Tag } from '../tag/entities/tag.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  async create(dto: CreateClientDto, ownerId: string): Promise<Client> {
    const tags =
      dto.tags && dto.tags.length ? await this.tagRepo.findByIds(dto.tags) : [];

    const client = this.clientRepo.create({
      ...dto,
      ownerId,
      tags,
    });
    try {
      return await this.clientRepo.save(client);
    } catch (err) {
      // Detect the unique‐constraint on owner+email
      if (
        err instanceof QueryFailedError &&
        err.message.includes('IDX_clients_owner_email')
      ) {
        throw new ConflictException(
          `A client with email "${dto.email}" already exists.`,
        );
      }
      throw err; // re‑throw anything else
    }
  }

  async findAll(
    query: ListClientsDto,
    ownerId: string,
  ): Promise<{ data: Client[]; total: number }> {
    const {
      page,
      limit,
      status,
      search,
      company,
      createdFrom,
      createdTo,
      tag,
    } = query;

    const qb = this.clientRepo
      .createQueryBuilder('client')
      .where('client.deletedAt IS NULL')
      .andWhere('client.ownerId = :ownerId', { ownerId })
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

    if (company) {
      qb.andWhere('client.company ILIKE :company', { company: `%${company}%` });
    }

    if (createdFrom) {
      qb.andWhere('client.createdAt >= :from', { from: createdFrom });
    }

    if (createdTo) {
      qb.andWhere('client.createdAt <= :to', { to: createdTo });
    }

    if (tag) {
      qb.andWhere(':tag = ANY(client.tags)', { tag });
    }

    const [clients, total] = await qb.getManyAndCount();
    return { data: clients, total };
  }

  async findOne(id: string, ownerId: string): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id, ownerId, deletedAt: IsNull() },
      relations: ['tags'],
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    ownerId: string,
  ): Promise<Client> {
    const client = await this.findOne(id, ownerId);

    if (dto.tags) {
      client.tags = await this.tagRepo.findByIds(dto.tags);
    }

    // Merge all other fields, excluding tags
    const rest = { ...dto } as Partial<Client>;
    delete rest.tags;
    Object.assign(client, rest);

    return this.clientRepo.save(client);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const result = await this.clientRepo.softDelete({ id, ownerId });
    if (result.affected === 0) {
      throw new NotFoundException(`Client ${id} not found`);
    }
  }
}
