// src/user/user.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError, In } from 'typeorm';

import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

interface PostgresError {
  code?: string;
  detail?: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** SAFE lookup: no password hash exposed */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      relations: ['roles'],
    });
  }

  /** AUTH lookup: explicitly include password hash */
  async findOneByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password'],
    });
  }

  /** Create new user—hashing lives in the entity hooks */
  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create({ ...dto, roles: [] });
    try {
      const saved = await this.userRepo.save(user);
      this.logger.log(`User created: ${saved.id}`);
      return saved;
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        // err.driverError is any, so narrow it to our PostgresError interface
        const pgErr = err.driverError as PostgresError;
        if (pgErr.code === '23505') {
          this.logger.warn(`Email conflict: ${dto.email}`);
          throw new ConflictException(`Email ${dto.email} already in use`);
        }
      }
      this.logger.error(
        'Unexpected error saving user',
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
      throw new InternalServerErrorException();
    }
  }

  /** List all users (safe) */
  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['roles'] });
  }

  /** Get one user by ID (safe) */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Update user—entity hook will re‑hash if password changed */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.preload({ id, ...dto });
    if (!user) {
      this.logger.warn(`User not found for update: ${id}`);
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.userRepo.save(user);
  }

  /** Assign roles in a transaction */
  async assignRoles(id: string, dto: AssignRolesDto): Promise<User> {
    return this.dataSource.transaction(async (tm) => {
      const user = await tm.getRepository(User).findOne({
        where: { id },
        relations: ['roles'],
      });
      if (!user) throw new NotFoundException(`User ${id} not found`);

      const roles = await tm.getRepository(Role).findBy({
        id: In(dto.roleIds),
      });
      if (roles.length !== dto.roleIds.length) {
        throw new NotFoundException(`One or more roles not found`);
      }

      user.roles = roles;
      const saved = await tm.getRepository(User).save(user);
      this.logger.log(`Assigned ${roles.length} roles to user ${id}`);
      return saved;
    });
  }
}
