import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';

import { generateOrderNumber } from '../common/utils/generate-order-number';
import { User } from '../entities/user.entity';
import { PurchaseOrderStatus } from './enums/purchase-order-status.enum';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,

    @InjectRepository(PurchaseOrderItem)
    private readonly itemRepo: Repository<PurchaseOrderItem>,

    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly dataSource: DataSource,
  ) {}

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    user: User,
  ): Promise<PurchaseOrder> {
    const { supplierId, warehouseId, orderDate, expectedDate, items } = dto;

    if (!items || items.length === 0) {
      throw new BadRequestException(
        'A purchase order must include at least one item.',
      );
    }

    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const warehouse = await this.warehouseRepo.findOne({
      where: { id: warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const orderNumber = await generateOrderNumber('PO', this.poRepo);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalAmount = 0;

      // ✅ FIX: Explicit cast to avoid TS2769
      const purchaseOrder: PurchaseOrder = this.poRepo.create({
        orderNumber,
        supplier,
        warehouse,
        status: PurchaseOrderStatus.PENDING,
        orderDate,
        expectedDate,
        createdBy: user,
        totalAmount: 0,
      });

      const savedPurchaseOrder = await queryRunner.manager.save(purchaseOrder);

      const poItems: PurchaseOrderItem[] = [];

      for (const item of items) {
        const product = await this.productRepo.findOne({
          where: { id: +item.productId },
        });

        if (!product) {
          throw new NotFoundException(`Product not found: ${item.productId}`);
        }

        const itemTotal = item.quantity * item.unitPrice;
        totalAmount += itemTotal;

        const poItem = this.itemRepo.create({
          purchaseOrder: savedPurchaseOrder, // ✅ FIX: make sure this is a single PO object
          product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          receivedQty: 0,
        } as Partial<PurchaseOrderItem>); // <-- helpful for strict TS

        poItems.push(poItem);
      }

      await queryRunner.manager.save(PurchaseOrderItem, poItems);
      // ✅ FIX: update totalAmount
      savedPurchaseOrder.totalAmount = totalAmount;
      await queryRunner.manager.save(PurchaseOrder, savedPurchaseOrder);

      await queryRunner.commitTransaction();
      return savedPurchaseOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
