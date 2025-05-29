// src/inventory/purchase/dto/update-purchase.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseDto } from './create-purchase.dto';

export class UpdatePurchaseDto extends PartialType(CreatePurchaseDto) {}
