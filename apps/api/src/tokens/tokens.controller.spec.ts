import { Test } from '@nestjs/testing';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { ListTokensDto } from './dto/list-tokens.dto';
import { CandleInterval, ListCandlesDto } from './dto/list-candles.dto';

describe('TokensController', () => {
  it('delegates list queries to the service', async () => {
    const expected = {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    const service = { list: jest.fn().mockResolvedValue(expected) };
    const module = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [{ provide: TokensService, useValue: service }],
    }).compile();
    const controller = module.get(TokensController);
    const query = new ListTokensDto();
    await expect(controller.list(query)).resolves.toEqual(expected);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('delegates a validated candle query to the service', async () => {
    const service = { candles: jest.fn().mockResolvedValue([]) };
    const module = await Test.createTestingModule({
      controllers: [TokensController],
      providers: [{ provide: TokensService, useValue: service }],
    }).compile();
    const query = Object.assign(new ListCandlesDto(), {
      interval: CandleInterval.FIVE_MINUTES,
      limit: 100,
    });
    const address = `0x${'1'.repeat(40)}`;
    await expect(
      module.get(TokensController).candles({ address }, query),
    ).resolves.toEqual([]);
    expect(service.candles).toHaveBeenCalledWith(address, query);
  });
});
