import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}
  @Get('platform')
  @ApiOperation({ summary: 'Get indexed platform statistics' })
  platform() {
    return this.stats.platform();
  }
}
