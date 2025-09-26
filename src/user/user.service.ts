// src/user/user.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError, In } from 'typeorm';

import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Company } from '../inventory/company/entities/company.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

interface PostgresError {
  code?: string;
  detail?: string;
}

// helper type for queries where password is explicitly selected
type UserWithPassword = User & {
  password: string;
  comparePassword(plain: string): Promise<boolean>;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

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
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.roles', 'roles')
      .where('user.email = :email', { email })
      .getOne();
  }

  /** Create new user—hashing lives in the entity hooks */
  async create(dto: CreateUserDto): Promise<User> {
    const roleNames: string[] = Array.isArray(dto.roleNames)
      ? dto.roleNames.map((r) =>
          String(r)
            .toLowerCase()
            .replace(/[\W_]+/g, ''),
        )
      : [];

    const isSuperAdmin = roleNames.includes('superadmin');

    if (!dto.companyId && !isSuperAdmin) {
      this.logger.warn(
        `Attempt to create non-super user without companyId: ${dto.email}`,
      );
      throw new BadRequestException(
        'companyId is required for non-superadmin users',
      );
    }

    let company: Company | null = null;
    if (dto.companyId) {
      company = await this.companyRepo.findOne({
        where: { id: dto.companyId },
      });
      if (!company) {
        this.logger.warn(
          `Attempt to create user with non-existent company: ${dto.companyId}`,
        );
        throw new NotFoundException(`Company ${dto.companyId} not found`);
      }
    }

    const userPayload: Partial<User> = {
      ...dto,
      roles: [],
    };

    if (company) {
      userPayload.companyId = company.id;
      userPayload.company = company;
    } else {
      userPayload.companyId = undefined;
      userPayload.company = undefined;
    }

    const user = this.userRepo.create(userPayload as User);

    try {
      const saved = await this.userRepo.save(user);
      this.logger.log(`User created: ${saved.id}`);

      return this.userRepo.findOneOrFail({
        where: { id: saved.id },
        relations: ['roles', 'company'],
      });
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
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
      relations: ['roles', 'company'],
    });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** Update user—entity hook will re-hash if password changed */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.preload({ id, ...dto });
    if (!user) {
      this.logger.warn(`User not found for update: ${id}`);
      throw new NotFoundException(`User ${id} not found`);
    }

    const saved = await this.userRepo.save(user);

    const full = await this.userRepo.findOne({
      where: { id: saved.id },
      relations: ['roles', 'company'],
    });

    if (!full) {
      this.logger.warn(`User saved but could not be reloaded: ${saved.id}`);
      throw new InternalServerErrorException('Failed to load updated user');
    }

    return full;
  }

  /** Assign roles in a transaction */
  async assignRoles(id: string, dto: AssignRolesDto): Promise<User> {
    if (
      !dto.roleIds ||
      !Array.isArray(dto.roleIds) ||
      dto.roleIds.length === 0
    ) {
      throw new BadRequestException(
        'roleIds is required and must be a non-empty array of UUIDs',
      );
    }

    const roleIds = dto.roleIds;

    return this.dataSource.transaction(async (tm) => {
      const user = await tm.getRepository(User).findOne({
        where: { id },
        relations: ['roles'],
      });
      if (!user) throw new NotFoundException(`User ${id} not found`);

      const roles = await tm.getRepository(Role).findBy({
        id: In(roleIds),
      });

      if (roles.length !== roleIds.length) {
        throw new NotFoundException('One or more roles not found');
      }

      user.roles = roles;
      const saved = await tm.getRepository(User).save(user);
      this.logger.log(`Assigned ${roles.length} roles to user ${id}`);

      return saved;
    });
  }

  /** Soft-delete a user by id (sets deletedAt). Throws NotFound if user doesn't exist. */
  async remove(id: string): Promise<void> {
    const existing = await this.userRepo.findOne({
      where: { id },
      withDeleted: false,
    });

    if (!existing) {
      this.logger.warn(`User not found for soft delete: ${id}`);
      throw new NotFoundException(`User ${id} not found`);
    }

    try {
      await this.userRepo.softDelete(id);
      this.logger.log(`User soft-deleted: ${id}`);
    } catch (err) {
      this.logger.error(
        `Error performing soft delete for user ${id}`,
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  /** Change a user's password (self or admin reset) */
  async changePassword(
    targetUserId: string,
    dto: { currentPassword?: string; newPassword: string },
    performedByUserId: string | null,
    performedByRoles: string[] | null,
  ): Promise<void> {
    const target = (await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: targetUserId })
      .getOne()) as UserWithPassword | null;

    if (!target) {
      this.logger.warn(`User not found for password change: ${targetUserId}`);
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const isSelf = performedByUserId === targetUserId;

    const normalizedRoles = Array.isArray(performedByRoles)
      ? performedByRoles.map((r) =>
          String(r)
            .toLowerCase()
            .replace(/[\W_]+/g, ''),
        )
      : [];

    const isAdmin =
      normalizedRoles.includes('admin') ||
      normalizedRoles.includes('superadmin');

    if (!isSelf && !isAdmin) {
      this.logger.warn(
        `User ${performedByUserId} forbidden to change password for ${targetUserId}`,
      );
      throw new ForbiddenException('Not allowed to change this user password');
    }

    if (isSelf) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'currentPassword is required for self password change',
        );
      }

      const matches = await target.comparePassword(dto.currentPassword);
      if (!matches) {
        this.logger.warn(`Invalid current password for user ${targetUserId}`);
        throw new BadRequestException('Current password is incorrect');
      }
    }

    target.password = dto.newPassword;

    try {
      await this.userRepo.save(target);
      this.logger.log(
        `Password updated for user ${targetUserId} by ${performedByUserId ?? 'system'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to change password for ${targetUserId}`,
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
      throw new InternalServerErrorException('Failed to change password');
    }
  }
}
