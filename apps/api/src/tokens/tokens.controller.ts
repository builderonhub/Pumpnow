import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressParamDto } from '../common/dto/address-param.dto';
import { ListTokenChildrenDto } from './dto/list-token-children.dto';
import { ListTokensDto } from './dto/list-tokens.dto';
import { TokensService } from './tokens.service';

@ApiTags('tokens')
@Controller('tokens')
export class TokensController {
  constructor(private readonly tokens: TokensService) {}
  @Get() @ApiOperation({ summary: 'List indexed tokens' }) list(
    @Query() query: ListTokensDto,
  ) {
    return this.tokens.list(query);
  }
  @Get(':address') @ApiOperation({ summary: 'Get token details' }) findOne(
    @Param() params: AddressParamDto,
  ) {
    return this.tokens.findOne(params.address);
  }
  @Get(':address/trades')
  @ApiOperation({ summary: 'List token trades' })
  trades(
    @Param() params: AddressParamDto,
    @Query() query: ListTokenChildrenDto,
  ) {
    return this.tokens.trades(params.address, query);
  }
  @Get(':address/holders')
  @ApiOperation({ summary: 'List token holders' })
  holders(
    @Param() params: AddressParamDto,
    @Query() query: ListTokenChildrenDto,
  ) {
    return this.tokens.holders(params.address, query);
  }
}
