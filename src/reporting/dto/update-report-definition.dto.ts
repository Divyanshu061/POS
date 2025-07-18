import { PartialType } from '@nestjs/mapped-types';
import { CreateReportDefinitionDto } from './create-report-definition.dto';

export class UpdateReportDefinitionDto extends PartialType(
  CreateReportDefinitionDto,
) {}
