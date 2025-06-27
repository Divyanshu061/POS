import { IsUUID, IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePOItemDto {
  @IsUUID()
  itemId!: string;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  receivedQty!: number;
}

export class ReceivePurchaseOrderDto {
  @IsUUID()
  purchaseOrderId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items!: ReceivePOItemDto[];
}
