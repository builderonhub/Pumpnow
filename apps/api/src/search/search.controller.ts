import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchDto } from './dto/search.dto';
import { SearchService } from './search.service';
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get()
  @ApiOperation({ summary: 'Search tokens by address, name, or symbol' })
  search(@Query() query: SearchDto) {
    return this.searchService.search(query);
  }
}
