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
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';
import { Product } from '../inventory/product/entities/product.entity';

import { generateOrderNumber } from '../common/utils/generate-order-number';
import { User } from '../entities/user.entity';
import { PurchaseOrderStatus } from './enums/purchase-order-status.enum';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  // Create a new PO
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

      // Create and save PO
      const purchaseOrder = queryRunner.manager.create(PurchaseOrder, {
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

      // Create PO items
      const poItems: PurchaseOrderItem[] = [];
      for (const itemDto of items) {
        const product = await this.productRepo.findOne({
          where: { id: +itemDto.productId },
        });
        if (!product)
          throw new NotFoundException(
            `Product not found: ${itemDto.productId}`,
          );

        const itemTotal = itemDto.quantity * itemDto.unitPrice;
        totalAmount += itemTotal;

        const poItem = queryRunner.manager.create(PurchaseOrderItem, {
          purchaseOrder: savedPurchaseOrder,
          purchaseOrderId: savedPurchaseOrder.id,
          product: product,
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice.toString(),
          receivedQty: 0,
        });
        poItems.push(poItem);
      }

      await queryRunner.manager.save(poItems);
      savedPurchaseOrder.totalAmount = totalAmount;
      await queryRunner.manager.save(savedPurchaseOrder);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      // reload full PO with items + product + createdBy (with eager roles), supplier, warehouse
      const fullPo = await this.poRepo.findOne({
        where: { id: savedPurchaseOrder.id },
        relations: [
          'supplier',
          'warehouse',
          'createdBy', // roles come along via eager:true
          'items',
          'items.product',
        ],
      });
      if (!fullPo) {
        throw new NotFoundException(
          `PurchaseOrder not found after save: ${savedPurchaseOrder.id}`,
        );
      }
      return fullPo;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(message);
    } finally {
      await queryRunner.release();
    }
  }

  // List all POs
  async findAll(): Promise<PurchaseOrder[]> {
    return this.poRepo.find({
      relations: [
        'supplier',
        'warehouse',
        'createdBy',
        'items',
        'items.product',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // Retrieve a single PO by ID
  async findOne(id: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: [
        'supplier',
        'warehouse',
        'createdBy',
        'items',
        'items.product',
      ],
    });
    if (!po) throw new NotFoundException(`PurchaseOrder not found: ${id}`);
    return po;
  }

  // Receive goods (partial/full) and update status/inventory
  async receiveGoods(
    id: string,
    receiveDto: ReceivePurchaseOrderDto,
  ): Promise<PurchaseOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id },
        relations: ['items', 'items.product', 'supplier', 'warehouse'],
      });
      if (!po) throw new NotFoundException(`PurchaseOrder not found: ${id}`);

      for (const { itemId, receivedQty } of receiveDto.items) {
        const poItem = po.items.find((item) => item.id === itemId);
        if (!poItem)
          throw new NotFoundException(`PO item not found: ${itemId}`);

        const newReceived = poItem.receivedQty + receivedQty;
        if (receivedQty <= 0 || newReceived > poItem.quantity) {
          throw new BadRequestException(
            `Invalid receive quantity for item ${itemId}`,
          );
        }

        poItem.receivedQty = newReceived;
        await queryRunner.manager.save(poItem);

        // Adjust warehouse stock level
        let stockLevel = await queryRunner.manager.findOne(StockLevel, {
          where: {
            warehouse: { id: po.warehouse.id },
            product: { id: poItem.product.id },
          },
          relations: ['warehouse', 'product'],
        });
        if (!stockLevel) {
          stockLevel = queryRunner.manager.create(StockLevel, {
            warehouse: po.warehouse,
            product: poItem.product,
            quantity: 0,
            companyId: po.warehouse.companyId,
          });
        }
        stockLevel.quantity += receivedQty;
        await queryRunner.manager.save(stockLevel);
      }

      const allReceived = po.items.every((i) => i.receivedQty === i.quantity);
      po.status = allReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      const updatedPo = await queryRunner.manager.save(po);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      // reload full PO
      const fullPo = await this.poRepo.findOne({
        where: { id: updatedPo.id },
        relations: [
          'supplier',
          'warehouse',
          'createdBy',
          'items',
          'items.product',
        ],
      });
      if (!fullPo) {
        throw new NotFoundException(
          `PurchaseOrder not found after receive: ${updatedPo.id}`,
        );
      }
      return fullPo;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(message);
    } finally {
      await queryRunner.release();
    }
  }
}
