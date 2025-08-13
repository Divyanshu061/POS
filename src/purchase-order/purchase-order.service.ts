// src/purchase-order/purchase-order.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

import { Supplier } from '../inventory/supplier/entities/supplier.entity';
import { Warehouse } from '../inventory/warehouse/entities/warehouse.entity';
import { Product } from '../inventory/product/entities/product.entity';
import { User } from '../entities/user.entity';

import { generateOrderNumber } from '../common/utils/generate-order-number';
import { PurchaseOrderStatus } from './enums/purchase-order-status.enum';
import { StockLevelService } from '../inventory/stock-level/stock-level.service';
import { TransactionType } from '../inventory/transaction/entities/transaction.entity';

const PO_CREATE_ROLES = ['admin', 'store_manager'];
const PO_RECEIVE_ROLES = ['admin', 'warehouse_staff'];

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
    private readonly stockLevelService: StockLevelService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  private async ensureUserHasAnyRole(userId: string, allowedRoles: string[]) {
    const u = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!u) throw new NotFoundException('User not found');
    const roleNames = (u.roles || []).map((r) => r.name);
    if (!roleNames.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    user: User,
  ): Promise<PurchaseOrder> {
    await this.ensureUserHasAnyRole(user.id, PO_CREATE_ROLES);

    const { supplierId, warehouseId, orderDate, expectedDate, items } = dto;
    if (!items?.length) {
      throw new BadRequestException('At least one item must be included');
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
      const po = queryRunner.manager.create(PurchaseOrder, {
        orderNumber,
        supplier,
        warehouse,
        status: PurchaseOrderStatus.PENDING,
        orderDate,
        expectedDate,
        createdBy: user,
        totalAmount: 0,
      });
      const savedPO = await queryRunner.manager.save(po);

      let totalAmount = 0;
      const poItems: PurchaseOrderItem[] = [];

      for (const itemDto of items) {
        const product = await this.productRepo.findOne({
          where: { id: +itemDto.productId },
        });
        if (!product)
          throw new NotFoundException(
            `Product not found: ${itemDto.productId}`,
          );

        totalAmount += itemDto.quantity * itemDto.unitPrice;
        const poItem = queryRunner.manager.create(PurchaseOrderItem, {
          purchaseOrder: savedPO,
          purchaseOrderId: savedPO.id,
          product,
          productId: product.id,
          quantity: itemDto.quantity,
          unitPrice: itemDto.unitPrice.toString(),
          receivedQty: 0,
        });
        poItems.push(poItem);
      }

      await queryRunner.manager.save(poItems);
      savedPO.totalAmount = totalAmount;
      await queryRunner.manager.save(savedPO);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      await queryRunner.release();
    }

    const fullPO = await this.poRepo.findOne({
      where: { orderNumber },
      relations: [
        'supplier',
        'warehouse',
        'createdBy',
        'items',
        'items.product',
      ],
    });
    if (!fullPO)
      throw new NotFoundException('PurchaseOrder not found after save');
    return fullPO;
  }

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

  /**
   * Transactional receiveGoods:
   * - updates PO items' receivedQty
   * - for each received item, creates stock transaction and updates stock level (via stockLevelService)
   * All in a single DB transaction to maintain consistency.
   */
  async receiveGoods(
    id: string,
    dto: ReceivePurchaseOrderDto,
    user: User,
  ): Promise<PurchaseOrder> {
    await this.ensureUserHasAnyRole(user.id, PO_RECEIVE_ROLES);

    if (!dto.items?.length)
      throw new BadRequestException('No items provided to receive');

    // collect low-stock alerts to send after commit
    const lowAlerts: { productName: string; currentQty: number }[] = [];

    // Single transaction for PO updates + stock adjustments (pass manager into adjustStock)
    await this.dataSource.transaction(async (manager) => {
      const po = await manager.findOne(PurchaseOrder, {
        where: { id },
        relations: ['items', 'items.product', 'warehouse'],
      });
      if (!po) throw new NotFoundException(`PurchaseOrder not found: ${id}`);

      for (const { itemId, receivedQty } of dto.items) {
        const item = po.items.find((i) => i.id === itemId);
        if (!item) throw new NotFoundException(`PO item not found: ${itemId}`);
        const newQty = item.receivedQty + receivedQty;
        if (receivedQty < 1 || newQty > item.quantity) {
          throw new BadRequestException(
            `Invalid receive quantity for item ${itemId}`,
          );
        }

        item.receivedQty = newQty;
        await manager.save(item);

        // adjustStock participates in the transaction via manager
        // EXPECT: stockLevelService.adjustStock returns { stock, low } when called with manager
        const { stock, low } = await this.stockLevelService.adjustStock(
          {
            productId: item.product.id,
            warehouseId: po.warehouse.id,
            companyId: po.warehouse.companyId,
            type: TransactionType.IN,
            quantity: receivedQty,
            reference: `PO#${po.id}`,
          },
          manager,
        );

        if (low) {
          lowAlerts.push({
            productName: stock.product.name,
            currentQty: stock.quantity,
          });
        }
      }

      po.status = po.items.every((i) => i.receivedQty === i.quantity)
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      await manager.save(po);
    });

    // transaction committed successfully at this point — safe to send alerts
    if (lowAlerts.length > 0) {
      const recipient = this.configService.get<string>(
        'LOW_STOCK_ALERT_EMAIL',
        'procurement@yourcompany.com',
      );
      for (const alert of lowAlerts) {
        // send after commit
        await this.stockLevelService.sendLowStockAlert(recipient, alert);
      }
    }

    // Return fresh PO with relations
    return this.findOne(id);
  }
}
