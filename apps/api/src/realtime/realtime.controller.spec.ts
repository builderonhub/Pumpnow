import { Subject } from 'rxjs';
import { RealtimeController } from './realtime.controller';
import type { RealtimeEvent } from './realtime.service';

describe('RealtimeController', () => {
  it('requests a full client refresh on every SSE connection', (done) => {
    const controller = new RealtimeController({
      stream: () => new Subject<RealtimeEvent>().asObservable(),
    } as never);
    controller.events().subscribe((message) => {
      expect(message.type).toBe('sync.required');
      done();
    });
  });

  it('forwards Redis events as named SSE messages', (done) => {
    const subject = new Subject<RealtimeEvent>();
    const controller = new RealtimeController({
      stream: () => subject.asObservable(),
    } as never);
    let messages = 0;
    controller.events().subscribe((message) => {
      messages += 1;
      if (messages === 1) return;
      expect(message.type).toBe('trade.created');
      expect(message.data).toEqual(
        expect.objectContaining({ tokenAddress: '0xabc' }),
      );
      done();
    });
    subject.next({
      type: 'trade.created',
      tokenAddress: '0xabc',
      transactionHash: '0x1',
      occurredAt: '2026-07-20T00:00:00.000Z',
    });
  });
});
