// src/inventory/warehouse/dto/update-warehouse.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateWarehouseDto } from './create-warehouse.dto';

export class UpdateWarehouseDto extends PartialType(CreateWarehouseDto) {}
