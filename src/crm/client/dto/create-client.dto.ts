/// src/crm/client/dto/create-client.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  ArrayUnique,
  IsUUID,
} from 'class-validator';
import { ClientStatus } from '../entities/client.entity';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Name of the client' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: 'CTO',
    description: 'Client title or designation',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example: 'jane.doe@acme.com',
    description: 'Client contact email',
  })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    example: '+1-202-555-0143',
    description: 'Client phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    enum: ClientStatus,
    description: 'Current status of client',
  })
  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-of-tag-1', 'uuid-of-tag-2'],
    description: 'Tag IDs to categorize clients',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  tags?: string[];
}
