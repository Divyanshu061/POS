import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
  BadRequestException,
  Query,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentCompany } from '../../auth/decorators/current-company.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';

import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProductListResponseDto } from './dto/product-list-response.dto';
import { ProductReadDto } from './dto/product-read.dto';

// Type guard to ensure the uploaded file has a Buffer
function hasBuffer(f: unknown): f is Express.Multer.File & { buffer: Buffer } {
  return !!f && typeof f === 'object' && f !== null && 'buffer' in f;
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('inventory/products')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  /**
   * GET /inventory/products
   * Query params:
   *  - search (string) matches name|sku|barcode (ILIKE)
   *  - page (int, default 1), limit (int, default 25)
   *  - sort (e.g., name:asc | createdAt:desc) — whitelisted in service
   *  - categoryId (uuid), supplierId (uuid)
   * Legacy:
   *  - skip (int), take (int) → auto-converted to page/limit
   */
  @Get()
  @Roles('admin', 'store_manager', 'sales_rep')
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    example: 'name:asc',
  })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiOkResponse({ type: ProductListResponseDto })
  findAll(
    @CurrentCompany() companyId: string,
    @Query('search') search?: string,

    // preferred paging
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,

    // legacy paging (optional; no pipes so absence won't 400)
    @Query('skip') skip?: string,
    @Query('take') take?: string,

    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,

    // sorting
    @Query('sort') sort?: string,
  ) {
    // If skip/take provided, convert → page/limit
    if (skip !== undefined && take !== undefined) {
      const s = Number(skip);
      const t = Number(take);
      if (Number.isFinite(s) && Number.isFinite(t) && t > 0) {
        page = Math.floor(Math.max(0, s) / Math.max(1, t)) + 1;
        limit = t;
      }
    }

    // sanitize page/limit
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25)); // clamp to 100

    return this.svc.findAll(companyId, {
      search,
      page: safePage,
      limit: safeLimit,
      categoryId,
      supplierId,
      sort,
    });
  }

  @Get('dropdown')
  @Roles('admin', 'store_manager', 'sales_rep')
  @ApiOkResponse({ type: [ProductReadDto] })
  dropdown(@CurrentCompany() companyId: string) {
    return this.svc.findDropdown(companyId);
  }

  @Get(':id')
  @Roles('admin', 'store_manager', 'sales_rep')
  @ApiOkResponse({ type: ProductReadDto })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentCompany() companyId: string,
  ) {
    return this.svc.findOne(companyId, id.toString());
  }

  @Post()
  @Roles('admin', 'store_manager')
  @ApiOkResponse({ type: ProductReadDto })
  create(
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateProductDto,
  ) {
    if (!userId)
      throw new BadRequestException('Cannot determine user ID from token');
    return this.svc.create(companyId, dto, userId);
  }

  @Patch(':id')
  @Roles('admin', 'store_manager')
  @ApiOkResponse({ type: ProductReadDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: UpdateProductDto,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.update(companyId, id.toString(), dto, userId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('Cannot determine user ID from token');
    }
    return this.svc.remove(companyId, id.toString(), userId);
  }

  /**
   * POST /inventory/products/import
   * Accepts multipart/form-data with file field named either `file` or `csv`.
   * Query param: dryRun (true|false) — default true.
   */
  @Post('import')
  @Roles('admin', 'store_manager')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'csv', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        // OpenAPI can't express "either/or" required fields, so we list both.
        file: { type: 'string', format: 'binary' },
        csv: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean', default: true },
      },
      // note: we intentionally don't require both; server accepts either `file` or `csv`
    },
  })
  importCsv(
    @CurrentCompany() companyId: string,
    @UserId() userId: string | null,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; csv?: Express.Multer.File[] },
    @Query('dryRun') dryRun?: string,
  ) {
    // pick first available file from either field
    const file = (files.file && files.file[0]) ?? (files.csv && files.csv[0]);

    if (!hasBuffer(file)) {
      throw new BadRequestException(
        'CSV file is required in form field "file" or "csv"',
      );
    }

    const isDryRun = (dryRun ?? 'true').toString().toLowerCase() === 'true';
    const csvBuffer: Buffer = file.buffer;

    return this.svc.importCsv(
      companyId,
      csvBuffer,
      isDryRun,
      userId ?? undefined,
    );
  }
}
