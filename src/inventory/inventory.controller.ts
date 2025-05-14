import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('products')
  findAll() {
    return this.inventoryService.findAllProducts();
  }

  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findProductById(id);
  }

  @Post('products')
  create(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto);
  }

  @Patch('products/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.inventoryService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  remove(@Param('id') id: string) {
    return this.inventoryService.deleteProduct(id);
  }

  // TODO: stock adjust, stock level, low-stock report endpoints...
}
