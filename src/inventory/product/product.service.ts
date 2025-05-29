import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async create(
    dto: CreateProductDto & { companyId: string },
  ): Promise<Product> {
    // dto.companyId is already a string
    const product = this.repo.create(dto);
    return this.repo.save(product);
  }

  async findAll(companyId: string): Promise<Product[]> {
    return this.repo.find({ where: { companyId } });
  }

  async findOne(id: string, companyId: string): Promise<Product> {
    const idNum = Number(id);
    const product = await this.repo.findOne({
      where: { id: idNum, companyId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with numeric ID ${idNum} not found for company ${companyId}`,
      );
    }
    return product;
  }

  async update(
    id: string,
    companyId: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    // Validate existence (throws if not found)
    await this.findOne(id, companyId);

    const idNum = Number(id);
    await this.repo.update({ id: idNum, companyId }, dto);

    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId: string): Promise<{ message: string }> {
    // Validate existence (throws if not found)
    await this.findOne(id, companyId);

    const idNum = Number(id);
    await this.repo.delete({ id: idNum, companyId });

    return { message: `Product with ID ${idNum} deleted successfully` };
  }
}
