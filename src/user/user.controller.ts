// src/user/user.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Logger,
  ForbiddenException,
  ParseUUIDPipe,
  Inject,
  forwardRef,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { RolesService } from '../roles/roles.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { UserResponseDto } from '../auth/dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly userService: UserService,
    @Inject(forwardRef(() => RolesService))
    private readonly roleService: RolesService,
  ) {}

  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @Post('signup')
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    this.logger.log(`Creating user ${dto.email}`);
    const user = await this.userService.create(dto);

    // Assign roles by IDs or names
    if (dto.roleIds?.length) {
      await this.userService.assignRoles(user.id, { roleIds: dto.roleIds });
    } else if (dto.roleNames?.length) {
      const roles = await this.roleService.findByNames(dto.roleNames);
      const ids = roles.map((r) => r.id);
      await this.userService.assignRoles(user.id, { roleIds: ids });
    }

    const complete = await this.userService.findOne(user.id);
    return new UserResponseDto(complete);
  }

  @Public()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(
    @CurrentUser('userId') userId: string | null,
  ): Promise<UserResponseDto> {
    if (!userId) {
      this.logger.warn(`Unauthorized profile access attempt`);
      throw new ForbiddenException('Not authenticated');
    }
    this.logger.log(`Fetching profile for ${userId}`);
    const user = await this.userService.findOne(userId);
    return new UserResponseDto(user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Array of users',
    type: [UserResponseDto],
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    this.logger.log(`Listing all users`);
    const users = await this.userService.findAll();
    return users.map((u) => new UserResponseDto(u));
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user (self or admin)' })
  @ApiResponse({
    status: 200,
    description: 'User updated',
    type: UserResponseDto,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('userId') meId: string | null,
    @CurrentUser('roles') myRoles: string[] | null,
  ): Promise<UserResponseDto> {
    if (!meId || !myRoles) {
      this.logger.warn(`Unauthorized update attempt`);
      throw new ForbiddenException('Not authenticated');
    }
    if (meId !== id && !myRoles.includes('admin')) {
      this.logger.warn(`User ${meId} forbidden to update ${id}`);
      throw new ForbiddenException('Not allowed to update this user');
    }
    this.logger.log(`Updating user ${id}`);
    const updated = await this.userService.update(id, dto);
    return new UserResponseDto(updated);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign roles to a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Roles assigned',
    type: UserResponseDto,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/roles')
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Assigning roles to user ${id}`);
    const user = await this.userService.assignRoles(id, dto);
    return new UserResponseDto(user);
  }
}
