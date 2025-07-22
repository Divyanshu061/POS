// --- src/reporting/widget/widget.controller.ts ---
import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from '../dto/create-widget.dto';
import { UpdateWidgetDto } from '../dto/update-widget.dto';

@Controller('reporting/widgets')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post()
  create(@Body() dto: CreateWidgetDto) {
    return this.widgetService.create(dto);
  }

  @Get()
  findAll(@Query('dashboardId') dashboardId?: string) {
    // if dashboardId is passed, filter by it; otherwise return all
    return this.widgetService.findAll(dashboardId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.widgetService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWidgetDto) {
    return this.widgetService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.widgetService.remove(id);
  }
}
