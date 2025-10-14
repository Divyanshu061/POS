// src/inventory/product/dto/product-read.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ProductReadDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() sku!: string;

  @ApiProperty({ nullable: true })
  barcode?: string | null;

  @ApiProperty({ nullable: true })
  description?: string | null;

  @ApiProperty()
  unitPrice!: number;

  @ApiProperty({ nullable: true })
  productNumber?: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Unit of measure, e.g., pcs, kg, litre',
  })
  unit?: string | null;

  @ApiProperty({ nullable: true })
  categoryId?: string | null;

  @ApiProperty({ nullable: true })
  supplierId?: string | null;

  @ApiProperty() companyId!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
