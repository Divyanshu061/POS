// File: src/reporting/reporting.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Res,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportingService } from './reporting.service';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { UpdateReportDefinitionDto } from './dto/update-report-definition.dto';
import { RunReportDto } from './dto/run-report.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import * as path from 'path';
import * as fs from 'fs';

@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  // === Report Definitions ===
  @Post('definitions')
  @HttpCode(HttpStatus.CREATED)
  createDefinition(@Body() dto: CreateReportDefinitionDto) {
    return this.reportingService.createDefinition(dto);
  }

  @Get('definitions')
  listDefinitions() {
    return this.reportingService.getAllDefinitions();
  }

  @Patch('definitions/:id') // updating a definition
  updateDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateReportDefinitionDto,
  ) {
    return this.reportingService.updateDefinition(id, dto);
  }

  // === Report Runs ===
  @Post('definitions/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  runReport(@Param('id') definitionId: string, @Body() dto: RunReportDto) {
    return this.reportingService.runReport(definitionId, dto);
  }

  @Get('runs/:id/download')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const run = await this.reportingService.getRunById(id);

    if (!run || !run.resultLocation || !run.resultLocation.path) {
      return res.status(404).json({ message: 'Report file not found.' });
    }

    const filePath = path.resolve(run.resultLocation.path);
    const fileExists = fs.existsSync(filePath);

    if (!fileExists) {
      return res.status(404).json({ message: 'Report file missing on disk.' });
    }

    return res.download(filePath, path.basename(filePath));
  }

  @Get('runs/:id')
  getRun(@Param('id') runId: string) {
    return this.reportingService.getRunById(runId);
  }

  // === Dashboards ===
  @Post('dashboards')
  @HttpCode(HttpStatus.CREATED)
  createDashboard(@Body() dto: CreateDashboardDto) {
    return this.reportingService.createDashboard(dto);
  }

  @Get('dashboards')
  listDashboards() {
    return this.reportingService.getAllDashboards();
  }

  @Get('dashboards/:id')
  getDashboard(@Param('id') id: string) {
    return this.reportingService.getDashboardById(id);
  }

  @Put('dashboards/:id')
  updateDashboard(@Param('id') id: string, @Body() dto: UpdateDashboardDto) {
    return this.reportingService.updateDashboard(id, dto);
  }

  @Delete('dashboards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDashboard(@Param('id') id: string) {
    return this.reportingService.deleteDashboard(id);
  }

  // === Widgets ===
  @Post('dashboards/:dashboardId/widgets')
  @HttpCode(HttpStatus.CREATED)
  createWidget(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.reportingService.createWidget(dashboardId, dto);
  }

  @Put('widgets/:id')
  updateWidget(@Param('id') id: string, @Body() dto: UpdateWidgetDto) {
    return this.reportingService.updateWidget(id, dto);
  }

  @Delete('widgets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWidget(@Param('id') id: string) {
    return this.reportingService.deleteWidget(id);
  }
}
