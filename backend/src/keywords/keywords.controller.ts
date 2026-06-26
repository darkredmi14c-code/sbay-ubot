import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminApiKeyGuard } from '../common/admin-api-key.guard';
import { BulkKeywordsDto, CreateKeywordDto } from '../common/dto';
import { KeywordsService } from './keywords.service';

@Controller('api/keywords')
@UseGuards(AdminApiKeyGuard)
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Get()
  findAll() {
    return this.keywordsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateKeywordDto) {
    return this.keywordsService.create(dto.word);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkKeywordsDto) {
    return this.keywordsService.bulkCreate(dto.words, dto.replace ?? false);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.keywordsService.remove(id);
  }
}
