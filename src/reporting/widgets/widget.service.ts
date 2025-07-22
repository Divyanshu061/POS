// src/reporting/widgets/widget.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DashboardWidget } from '../entities/dashboard-widget.entity';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { UpdateWidgetDto } from '../dto/update-widget.dto';
import { Dashboard } from '../entities/dashboard.entity';
import { ReportDefinition } from '../entities/report-definition.entity';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(DashboardWidget)
    private readonly widgetRepo: Repository<DashboardWidget>,
  ) {}

  /**
   * Create a new widget and save its dashboard & definition relations.
   */
  async create(dto: CreateWidgetDto): Promise<DashboardWidget> {
    const widget = this.widgetRepo.create({
      position: dto.position,
      settings: dto.settings,
      dashboard: { id: dto.dashboardId } as Dashboard,
      definition: { id: dto.reportDefinitionId } as ReportDefinition,
    });

    return this.widgetRepo.save(widget);
  }

  /**
   * List all widgets, or filter by dashboard if dashboardId provided.
   */
  async findAll(dashboardId?: string): Promise<DashboardWidget[]> {
    const where = dashboardId ? { dashboard: { id: dashboardId } } : {};

    return this.widgetRepo.find({
      where,
      relations: ['dashboard', 'definition'],
      order: {
        position: { row: 'ASC', col: 'ASC' },
      },
    });
  }

  /**
   * Fetch a single widget by its ID (includes relations).
   */
  async findOne(id: string): Promise<DashboardWidget> {
    const widget = await this.widgetRepo.findOne({
      where: { id },
      relations: ['dashboard', 'definition'],
    });

    if (!widget) {
      throw new NotFoundException(`Widget ${id} not found`);
    }
    return widget;
  }

  /**
   * Partially update a widget by ID. Uses preload() to merge existing + dto.
   */
  async update(id: string, dto: UpdateWidgetDto): Promise<DashboardWidget> {
    const widget = await this.widgetRepo.preload({
      id,
      ...dto,
      dashboard: dto.dashboardId
        ? ({ id: dto.dashboardId } as Dashboard)
        : undefined,
      definition: dto.reportDefinitionId
        ? ({ id: dto.reportDefinitionId } as ReportDefinition)
        : undefined,
    });

    if (!widget) {
      throw new NotFoundException(`Widget ${id} not found`);
    }
    return this.widgetRepo.save(widget);
  }

  /**
   * Delete a widget by ID. Throws if nothing was deleted.
   */
  async remove(id: string): Promise<void> {
    const result = await this.widgetRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Widget ${id} not found`);
    }
  }
}
