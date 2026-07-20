import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressParamDto } from '../common/dto/address-param.dto';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get(':address/portfolio')
  @ApiOperation({ summary: 'Get an indexed wallet portfolio' })
  portfolio(@Param() params: AddressParamDto) {
    return this.wallets.portfolio(params.address);
  }
}
