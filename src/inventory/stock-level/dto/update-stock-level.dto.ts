// src/inventory/stock-level/dto/update-stock-level.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateStockLevelDto } from './create-stock-level.dto';

export class UpdateStockLevelDto extends PartialType(CreateStockLevelDto) {}
