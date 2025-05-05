import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError, In } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly dataSource: DataSource,
  ) {}

  /** Find a user by email (for AuthService) */
  async findOneByEmail(email: string): Promise<User | undefined> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['roles'],
    });
    return user || undefined; // Ensures null is converted to undefined
  }

  /** Create a new user with NO roles by default, hashing password */
  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      ...dto,
      password: hashed,
      roles: [],
    });

    try {
      const saved = await this.userRepo.save(user);
      this.logger.log(`User ${saved.id} created`);
      return saved;
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const pgErr = err.driverError as { code?: string };
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

  /** List all users with their roles */
  async findAll(): Promise<User[]> {
    return this.userRepo.find({ relations: ['roles'] });
  }

  /** Get one user by ID */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      this.logger.warn(`User ${id} not found`);
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Update user fields; hash password if present */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.userRepo.preload({ id, ...dto });
    if (!user) {
      this.logger.warn(`User ${id} not found for update`);
      throw new NotFoundException(`User ${id} not found`);
    }

    return this.userRepo.save(user);
  }

  /** Assign a set of roles to a user inside a transaction */
  async assignRoles(id: string, dto: AssignRolesDto): Promise<User> {
    return this.dataSource.transaction(async (tm) => {
      const user = await tm
        .getRepository(User)
        .findOne({ where: { id }, relations: ['roles'] });

      if (!user) {
        throw new NotFoundException(`User ${id} not found`);
      }

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
