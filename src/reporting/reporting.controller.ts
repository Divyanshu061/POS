import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

import { ReportingService } from './reporting.service';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';
import { RunReportDto } from './dto/run-report.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';

import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentCompanyOptional } from '../auth/decorators/current-company.decorator';

import { UserId } from '../auth/decorators/user-id.decorator';

@Controller('reporting')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // === Report Definitions ===
  @Post('definitions')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  createDefinition(
    @Body() dto: CreateReportDefinitionDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    // Superadmin can leave companyId null (global template),
    // normal users must provide a company
    if (!companyId) {
      throw new BadRequestException(
        'Company required for creating report definition',
      );
    }
    return this.reportingService.createDefinition(dto, companyId);
  }

  @Get('definitions')
  @Roles('admin', 'superadmin')
  listDefinitions(@CurrentCompanyOptional() companyId: string | null) {
    return this.reportingService.getAllDefinitions(companyId);
  }

  @Patch('definitions/:id')
  @Roles('admin', 'superadmin')
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateReportDefinitionDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.updateDefinition(id, dto, companyId);
  }

  // === Report Runs ===
  @Post('definitions/:id/run')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.ACCEPTED)
  runReport(
    @Param('id') definitionId: string,
    @Body() dto: RunReportDto,
    @CurrentCompanyOptional() companyId: string | null,
    @UserId() userId: string | null,
  ) {
    // RunReportDto does not declare companyId; allow passing company via dto.filters.companyId
    const dtoCompanyId =
      typeof dto?.filters?.companyId === 'string'
        ? dto.filters.companyId
        : null;

    if (!companyId && !dtoCompanyId) {
      throw new BadRequestException(
        'Company must be specified for running reports (unless superadmin specifies one)',
      );
    }

    const targetCompanyId = companyId ?? dtoCompanyId;

    return this.reportingService.runReport(
      definitionId,
      dto,
      targetCompanyId,
      userId,
    );
  }

  @Get('runs/:id/download')
  @Roles('admin', 'superadmin')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const run = await this.reportingService.getRunById(id);

    if (!run || !run.resultLocation || !run.resultLocation.path) {
      return res.status(404).json({ message: 'Report file not found.' });
    }

    const filePath = path.resolve(run.resultLocation.path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Report file missing on disk.' });
    }

    return res.download(filePath, path.basename(filePath));
  }

  @Get('runs/:id')
  @Roles('admin', 'superadmin')
  getRun(@Param('id') runId: string) {
    return this.reportingService.getRunById(runId);
  }

  // === Dashboards ===
  @Post('dashboards')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  createDashboard(
    @Body() dto: CreateDashboardDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    if (!companyId) {
      throw new BadRequestException('Company required for creating dashboards');
    }
    return this.reportingService.createDashboard(dto, companyId);
  }

  @Get('dashboards')
  @Roles('admin', 'superadmin')
  listDashboards(@CurrentCompanyOptional() companyId: string | null) {
    return this.reportingService.getAllDashboards(companyId);
  }

  @Get('dashboards/:id')
  @Roles('admin', 'superadmin')
  getDashboard(
    @Param('id') id: string,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.getDashboardById(id, companyId);
  }

  @Put('dashboards/:id')
  @Roles('admin', 'superadmin')
  updateDashboard(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.updateDashboard(id, dto, companyId);
  }

  @Delete('dashboards/:id')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDashboard(
    @Param('id') id: string,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.deleteDashboard(id, companyId);
  }

  // === Widgets ===
  @Post('dashboards/:dashboardId/widgets')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  createWidget(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CreateWidgetDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.createWidget(dashboardId, dto, companyId);
  }

  @Put('widgets/:id')
  @Roles('admin', 'superadmin')
  updateWidget(
    @Param('id') id: string,
    @Body() dto: UpdateWidgetDto,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.updateWidget(id, dto, companyId);
  }

  @Delete('widgets/:id')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWidget(
    @Param('id') id: string,
    @CurrentCompanyOptional() companyId: string | null,
  ) {
    return this.reportingService.deleteWidget(id, companyId);
  }
}
