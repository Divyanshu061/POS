import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dashboard } from '../entities/dashboard.entity';
import { Company } from '../../inventory/company/entities/company.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Dashboard, Company])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
