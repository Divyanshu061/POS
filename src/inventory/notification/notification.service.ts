//src/inventory/notification/notification.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

interface LowStockContext {
  productName: string;
  currentQty: number;
}

interface StockAdjustmentContext {
  type: 'IN' | 'OUT';
  quantity: number;
  productName: string;
  reference?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send a low-stock alert email.
   * @param email       Recipient's email
   * @param context     Context data for the low-stock template
   */
  async sendLowStockAlert(
    email: string,
    context: LowStockContext,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `[ALERT] Low Stock for ${context.productName}`,
        template: 'low-stock',
        context,
      });
      this.logger.log(
        `Low-stock alert sent to ${email} for ${context.productName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send low-stock alert to ${email}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Send a stock-adjustment notification email.
   * @param email       Recipient's email
   * @param context     Context data for the stock-adjustment template
   */
  async sendStockAdjustment(
    email: string,
    context: StockAdjustmentContext,
  ): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Stock ${context.type} Notification: ${context.productName}`,
        template: 'stock-adjustment',
        context,
      });
      this.logger.log(
        `Stock-${context.type} notification sent to ${email} for ${context.productName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send stock-adjustment email to ${email}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
