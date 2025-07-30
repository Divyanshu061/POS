//src/integrations/integrations.module.ts

import { Module } from '@nestjs/common';
import { join } from 'path';

// Correct package names with standard hyphens
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

// NotificationModule should live alongside this file in integrations/notification
import { NotificationModule } from '../inventory/notification/notification.module';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: process.env.MAIL_TRANSPORT!,
      defaults: {
        from: '"Inventory System" <noreply@yourdomain.com>',
      },
      template: {
        dir: join(__dirname, '..', 'emails'),
        adapter: new HandlebarsAdapter(),
        options: { strict: true },
      },
    }),
    NotificationModule,
  ],
})
export class IntegrationsModule {}
