//src/common/utils/generate-order-number.ts

import { Repository, FindOptionsOrder } from 'typeorm';

interface HasOrderMetadata {
  orderNumber: string;
  createdAt: Date;
}

export async function generateOrderNumber<T extends HasOrderMetadata>(
  prefix: string,
  repo: Repository<T>,
): Promise<string> {
  const lastRecords = await repo.find({
    order: {
      createdAt: 'DESC',
    } as FindOptionsOrder<T>, // ✅ type-safe assert on the full order object
    take: 1,
  });

  let nextNumber = 1;
  if (lastRecords.length > 0) {
    const lastOrder = lastRecords[0];
    const lastNumberStr = lastOrder.orderNumber.replace(`${prefix}-`, '');
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  const formattedNumber = String(nextNumber).padStart(5, '0');
  return `${prefix}-${formattedNumber}`;
}
