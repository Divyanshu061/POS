import { IsEmail, IsString, IsInt, Min } from 'class-validator';

export class SendLowStockDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString({ message: 'productName must be a string' })
  productName!: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(0, { message: 'quantity must be at least 0' })
  quantity!: number;
}
