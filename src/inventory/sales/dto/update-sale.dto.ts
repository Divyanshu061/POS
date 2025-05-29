// src/inventory/sales/dto/update-sale.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleDto } from './create-sale.dto';

export class UpdateSaleDto extends PartialType(CreateSaleDto) {}
