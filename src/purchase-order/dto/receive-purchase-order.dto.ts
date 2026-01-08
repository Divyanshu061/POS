// src/purchase-order/dto/receive-purchase-order.dto.ts
import {
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePOItemDto {
  @IsUUID()
  itemId!: string;

  /**
   * require at least 1 — your service already rejects < 1
   */
  @IsInt()
  @Type(() => Number)
  @Min(1)
  receivedQty!: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items!: ReceivePOItemDto[];
}
