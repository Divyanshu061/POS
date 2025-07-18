// File: run-report-response.dto.ts

import { IsString, IsEnum } from 'class-validator';

export class RunReportResponseDto {
  @IsString()
  runId!: string;

  @IsEnum(['pending', 'running', 'completed', 'failed'])
  status!: 'pending' | 'running' | 'completed' | 'failed';
}
