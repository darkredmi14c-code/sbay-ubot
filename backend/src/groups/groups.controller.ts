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
import { BulkGroupsDto, CreateGroupDto } from '../common/dto';
import { GroupsService } from './groups.service';

@Controller('api/groups')
@UseGuards(AdminApiKeyGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto.identifier, dto.title);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkGroupsDto) {
    return this.groupsService.bulkCreate(dto.identifiers, dto.replace ?? false);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.groupsService.remove(id);
  }
}
