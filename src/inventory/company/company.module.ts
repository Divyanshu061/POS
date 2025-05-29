// src/inventory/company/company.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [CompanyService],
  controllers: [CompanyController],
  exports: [CompanyService],
})
export class CompanyModule {}
