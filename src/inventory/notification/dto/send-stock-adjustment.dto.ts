import {
  IsEmail,
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsIn,
} from 'class-validator';

export class SendStockAdjustmentDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString({ message: 'productName must be a string' })
  productName!: string;

  @IsIn(['IN', 'OUT'], { message: 'type must be either "IN" or "OUT"' })
  type!: 'IN' | 'OUT';

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;

  @IsOptional()
  @IsString({ message: 'reference must be a string if provided' })
  reference?: string;
}
