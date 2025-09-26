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
import { StockLevel } from '../inventory/stock-level/entities/stock-level.entity';

import { generateOrderNumber } from '../common/utils/generate-order-number';
import { PurchaseOrderStatus } from './enums/purchase-order-status.enum';
import { StockLevelService } from '../inventory/stock-level/stock-level.service';
import { TransactionType } from '../inventory/transaction/entities/transaction.entity';

import { AuthenticatedUser } from '../auth/decorators/current-user-id.decorator';

const PO_CREATE_ROLES = ['admin', 'store_manager'];
const PO_RECEIVE_ROLES = ['admin', 'warehouse_staff'];

type UserPayload = User | AuthenticatedUser;

/**
 * Narrowing helper: safe runtime check whether an unknown value has a named key.
 * After this returns true, you may treat `obj` as `Record<string, unknown>` for that key.
 */
function hasKey<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

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

  /**
   * Safely extract a user id from either a full User entity or the token-shaped
   * AuthenticatedUser object. Uses `hasKey` to avoid unsafe member access.
   */
  private getUserIdFromPayload(user?: UserPayload): string {
    if (!user) {
      throw new BadRequestException('Authenticated user id not available');
    }

    if (hasKey(user, 'userId') && typeof user.userId === 'string') {
      return user.userId;
    }

    if (hasKey(user, 'user_id') && typeof user.user_id === 'string') {
      return user.user_id;
    }

    if (hasKey(user, 'id') && typeof user.id === 'string') {
      return user.id;
    }

    throw new BadRequestException('Authenticated user id not available');
  }

  /**
   * Ensure user exists in DB and has at least one of the allowed roles.
   * Defensive: roles can be string[] or { name: string }[].
   */
  private async ensureUserHasAnyRole(userId: string, allowedRoles: string[]) {
    const u = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!u) throw new NotFoundException('User not found');

    const rawRoles = u.roles ?? [];

    const roleNames: string[] = [];
    for (const r of rawRoles as unknown[]) {
      if (typeof r === 'string') {
        roleNames.push(r);
        continue;
      }
      // use hasKey without extra generic parameters
      if (hasKey(r, 'name')) {
        const maybeName = (r as Record<string, unknown>)['name'];
        if (typeof maybeName === 'string') roleNames.push(maybeName);
      }
    }

    if (!roleNames.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Create a Purchase Order (tenant-aware).
   * Controller must pass `currentCompanyId` resolved by TenantGuard.
   */
  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    userPayload: UserPayload,
    currentCompanyId: string,
  ): Promise<PurchaseOrder> {
    const userId = this.getUserIdFromPayload(userPayload);
    await this.ensureUserHasAnyRole(userId, PO_CREATE_ROLES);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { supplierId, warehouseId, orderDate, expectedDate, items } = dto;
    if (!items?.length) {
      throw new BadRequestException('At least one item must be included');
    }

    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Load warehouse + company relation for tenant validation
    const warehouse = await this.warehouseRepo.findOne({
      where: { id: warehouseId },
      relations: ['company'],
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const warehouseCompanyId = warehouse.company?.id ?? null;
    if (!warehouseCompanyId) {
      throw new BadRequestException('Warehouse has no company assigned');
    }
    if (currentCompanyId && warehouseCompanyId !== currentCompanyId) {
      throw new ForbiddenException(
        'Warehouse does not belong to the current company',
      );
    }

    // Consider making generateOrderNumber tenant-aware in future
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
        if (!product) {
          throw new NotFoundException(
            `Product not found: ${itemDto.productId}`,
          );
        }

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

      // Re-query saved PO with necessary relations (including warehouse.company)
      const fullPO = await this.poRepo.findOne({
        where: { id: savedPO.id },
        relations: [
          'supplier',
          'warehouse',
          'warehouse.company',
          'createdBy',
          'items',
          'items.product',
        ],
      });

      if (!fullPO) {
        throw new NotFoundException('PurchaseOrder not found after save');
      }

      // Final defensive tenant check
      const finalWarehouseCompanyId = fullPO.warehouse?.company?.id ?? null;
      if (!finalWarehouseCompanyId) {
        throw new BadRequestException(
          'Saved warehouse has no company assigned',
        );
      }
      if (currentCompanyId && finalWarehouseCompanyId !== currentCompanyId) {
        throw new ForbiddenException(
          'PurchaseOrder does not belong to the current company',
        );
      }

      return fullPO;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * List POs for the given company
   */
  async findAll(currentCompanyId: string): Promise<PurchaseOrder[]> {
    return this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.warehouse', 'warehouse')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('warehouse.company_id = :companyId', {
        companyId: currentCompanyId,
      })
      .orderBy('po.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find one PO scoped to the given company
   */
  async findOne(id: string, currentCompanyId: string): Promise<PurchaseOrder> {
    const po = await this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.warehouse', 'warehouse')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('po.id = :id', { id })
      .andWhere('warehouse.company_id = :companyId', {
        companyId: currentCompanyId,
      })
      .getOne();

    if (!po) throw new NotFoundException(`PurchaseOrder not found: ${id}`);
    return po;
  }

  /**
   * Receive goods (transactional) — tenant-aware
   */
  async receiveGoods(
    id: string,
    dto: ReceivePurchaseOrderDto,
    userPayload: UserPayload,
    currentCompanyId: string,
  ): Promise<PurchaseOrder> {
    const userId = this.getUserIdFromPayload(userPayload);
    await this.ensureUserHasAnyRole(userId, PO_RECEIVE_ROLES);

    if (!dto.items?.length) {
      throw new BadRequestException('No items provided to receive');
    }

    const lowAlerts: { productName: string; currentQty: number }[] = [];

    await this.dataSource.transaction(async (manager) => {
      const po = await manager
        .getRepository(PurchaseOrder)
        .createQueryBuilder('po')
        .leftJoinAndSelect('po.items', 'items')
        .leftJoinAndSelect('items.product', 'product')
        .leftJoinAndSelect('po.warehouse', 'warehouse')
        .leftJoinAndSelect('warehouse.company', 'company')
        .where('po.id = :id', { id })
        .andWhere('company.id = :companyId', { companyId: currentCompanyId })
        .getOne();

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

        const warehouseCompanyId = po.warehouse?.company?.id;
        if (!warehouseCompanyId) {
          throw new BadRequestException('Warehouse has no company assigned');
        }

        const adjustResult = await this.stockLevelService.adjustStock(
          {
            productId: item.product.id,
            warehouseId: po.warehouse.id,
            type: TransactionType.IN,
            quantity: receivedQty,
            reference: `PO#${po.id}`,
          },
          warehouseCompanyId,
          userId,
          manager,
        );

        // Validate shape at runtime then narrow to the known typed shape
        if (
          !adjustResult ||
          typeof adjustResult !== 'object' ||
          !('stock' in adjustResult) ||
          !('low' in adjustResult)
        ) {
          throw new BadRequestException(
            'Unexpected response from stockLevelService.adjustStock',
          );
        }

        // safe narrow; StockLevelService.adjustStock returns { stock: StockLevel; low: boolean }
        const { stock, low } = adjustResult as {
          stock: StockLevel;
          low: boolean;
        };

        if (low) {
          lowAlerts.push({
            productName: stock.product?.name ?? 'unknown',
            currentQty: stock.quantity ?? 0,
          });
        }
      }

      po.status = po.items.every((i) => i.receivedQty === i.quantity)
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      await manager.save(po);
    });

    if (lowAlerts.length > 0) {
      const recipient = this.configService.get<string>(
        'LOW_STOCK_ALERT_EMAIL',
        'procurement@yourcompany.com',
      );
      for (const alert of lowAlerts) {
        await this.stockLevelService.sendLowStockAlert(recipient, alert);
      }
    }

    return this.findOne(id, currentCompanyId);
  }
}
