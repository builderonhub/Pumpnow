import { Test } from '@nestjs/testing';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { ListTokensDto } from './dto/list-tokens.dto';

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
});
