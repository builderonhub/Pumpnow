import { WalletsService } from './wallets.service';
import { PrismaService } from '../database/prisma.service';

describe('WalletsService', () => {
  it('returns created tokens, current holdings and recent trades from one snapshot', async () => {
    const prisma = {
      token: { findMany: jest.fn().mockReturnValue('created') },
      holder: { findMany: jest.fn().mockReturnValue('holdings') },
      trade: { findMany: jest.fn().mockReturnValue('trades') },
      $transaction: jest.fn().mockResolvedValue([[], [], []]),
    };
    const service = new WalletsService(prisma as unknown as PrismaService);
    await expect(service.portfolio('0xabc')).resolves.toEqual({
      address: '0xabc',
      createdTokens: [],
      holdings: [],
      trades: [],
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'created',
      'holdings',
      'trades',
    ]);
  });
});
