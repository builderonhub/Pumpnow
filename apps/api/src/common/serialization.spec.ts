import { Prisma } from '@pumpnow/database';
import { serializeValue } from './serialization';

describe('serializeValue', () => {
  it('serializes nested bigint, Decimal and Date values', () => {
    expect(
      serializeValue({
        id: 1n,
        amount: new Prisma.Decimal('12.34'),
        at: new Date('2026-07-20T00:00:00Z'),
      }),
    ).toEqual({
      id: '1',
      amount: '12.34',
      at: '2026-07-20T00:00:00.000Z',
    });
  });
});
