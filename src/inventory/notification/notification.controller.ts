import { Controller, Post, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SendLowStockDto } from './dto/send-low-stock.dto';
import { SendStockAdjustmentDto } from './dto/send-stock-adjustment.dto';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * POST /notifications/low-stock
   * BODY: { email, productName, quantity }
   */
  @Post('low-stock')
  async sendLowStock(@Body() dto: SendLowStockDto) {
    const { email, productName, quantity } = dto;
    await this.notificationService.sendLowStockAlert(
      email,
      productName,
      quantity,
    );
    return { message: 'Low‐stock alert email queued.' };
  }

  /**
   * POST /notifications/stock-adjustment
   * BODY: { email, productName, type, quantity, reference? }
   */
  @Post('stock-adjustment')
  async sendStockAdjustment(@Body() dto: SendStockAdjustmentDto) {
    const { email, productName, type, quantity, reference } = dto;
    await this.notificationService.sendStockAdjustment(
      email,
      type,
      quantity,
      productName,
      reference, // now matches the 5-parameter signature
    );
    return { message: 'Stock‐adjustment email queued.' };
  }
}
