import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, concat, map, of } from 'rxjs';
import { RealtimeService, type RealtimeEvent } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    const recovery: RealtimeEvent = {
      type: 'sync.required',
      transactionHash: 'recovery',
      occurredAt: new Date().toISOString(),
    };
    return concat(
      of({ type: recovery.type, data: recovery }),
      this.realtime.stream().pipe(map((data) => ({ type: data.type, data }))),
    );
  }
}
