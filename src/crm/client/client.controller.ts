// src/crm/client/client.controller.ts
import {
  Controller,
  UseGuards,
  Body,
  Param,
  Query,
  Post,
  Get,
  Put,
  Delete,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { Client } from './entities/client.entity';
import { UserId } from '../../auth/decorators/user-id.decorator';

@ApiTags('CRM / Clients')
@UseGuards(AuthGuard('jwt'))
@Controller('crm/clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201, type: Client })
  async create(
    @Body() dto: CreateClientDto,
    @UserId() ownerId: string,
  ): Promise<Client> {
    return this.clientService.create(dto, ownerId);
  }

  @Get()
  @ApiOperation({ summary: 'List clients with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of clients' })
  async findAll(
    @Query() query: ListClientsDto,
    @UserId() ownerId: string,
  ): Promise<{ data: Client[]; total: number }> {
    return this.clientService.findAll(query, ownerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client by ID' })
  @ApiResponse({ status: 200, type: Client })
  async findOne(
    @Param('id') id: string,
    @UserId() ownerId: string,
  ): Promise<Client> {
    return this.clientService.findOne(id, ownerId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a client' })
  @ApiResponse({ status: 200, type: Client })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @UserId() ownerId: string,
  ): Promise<Client> {
    return this.clientService.update(id, dto, ownerId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a client' })
  @ApiResponse({ status: 204, description: 'Client deleted' })
  async remove(
    @Param('id') id: string,
    @UserId() ownerId: string,
  ): Promise<void> {
    return this.clientService.remove(id, ownerId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a client' })
  @ApiResponse({ status: 200, type: Client })
  async updatePut(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @UserId() ownerId: string,
  ): Promise<Client> {
    return this.clientService.update(id, dto, ownerId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client (partial)' })
  @ApiResponse({ status: 200, type: Client })
  async updatePatch(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @UserId() ownerId: string,
  ): Promise<Client> {
    return this.clientService.update(id, dto, ownerId);
  }
}
