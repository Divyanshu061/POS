import { IsOptional, IsString } from 'class-validator';

export class CancelPurchaseOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
