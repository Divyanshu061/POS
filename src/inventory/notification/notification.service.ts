import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationService {
  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send a low-stock alert email.
   * @param email       Recipient’s email
   * @param productName Name of the product that is low on stock
   * @param quantity    Current quantity left
   */
  async sendLowStockAlert(
    email: string,
    productName: string,
    quantity: number,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: `[ALERT] Low Stock for ${productName}`,
      template: './low-stock', // matches low-stock.hbs
      context: { productName, quantity },
    });
  }

  /**
   * Send a stock-adjustment notification email.
   * @param email       Recipient’s email
   * @param type        "IN" or "OUT"
   * @param quantity    Quantity added/removed
   * @param productName Name of the product adjusted
   * @param reference?  Optional reference (e.g., invoice number)
   */
  async sendStockAdjustment(
    email: string,
    type: 'IN' | 'OUT',
    quantity: number,
    productName: string,
    reference?: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: email,
      subject: `Stock ${type} Notification: ${productName}`,
      template: './stock-adjustment', // matches stock-adjustment.hbs
      context: { type, quantity, productName, reference: reference || '' },
    });
  }
}
