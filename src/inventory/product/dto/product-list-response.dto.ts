/// src/inventory/product/dto/product-list-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { ProductReadDto } from './product-read.dto';

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductReadDto] })
  data!: ProductReadDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
