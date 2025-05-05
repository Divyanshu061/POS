// src/user/user.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { UserRole } from '../entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly userService: UserService) {}

  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @Post('signup')
  async create(@Body() dto: CreateUserDto) {
    this.logger.log(`Creating user ${dto.email}`);
    return this.userService.create(dto);
  }

  @Public()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @Get('me')
  async getProfile(@CurrentUser('userId') userId: string | null) {
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }
    this.logger.log(`Fetching profile for ${userId}`);
    return this.userService.findOne(userId);
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of users' })
  @Get()
  async findAll() {
    this.logger.log(`Listing all users`);
    return this.userService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user (self or admin)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('userId') meId: string | null,
    @CurrentUser('roles') myRoles: string[] | null,
  ) {
    if (!meId || !myRoles) {
      throw new ForbiddenException('Not authenticated');
    }

    // allow self-update or admin
    if (meId !== id && !myRoles.includes(UserRole.ADMIN)) {
      this.logger.warn(`User ${meId} forbidden to update ${id}`);
      throw new ForbiddenException('Not allowed to update this user');
    }

    this.logger.log(`Updating user ${id}`);
    return this.userService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign roles to a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  @Patch(':id/roles')
  async assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ) {
    this.logger.log(`Assigning roles to user ${id}`);
    return this.userService.assignRoles(id, dto);
  }
}
