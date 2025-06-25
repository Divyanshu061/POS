import {
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePOItemDto {
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(1)
  receivedQty!: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items!: ReceivePOItemDto[];
}
