// File: src/reporting/reporting.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { CreateReportDefinitionDto } from './dto/create-report-definition.dto';
import { RunReportDto } from './dto/run-report.dto';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';

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

  // === Report Runs ===
  @Post('definitions/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  runReport(@Param('id') definitionId: string, @Body() dto: RunReportDto) {
    return this.reportingService.runReport(definitionId, dto);
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
