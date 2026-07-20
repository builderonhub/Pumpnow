import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.realtime
      .stream()
      .pipe(map((data) => ({ type: data.type, data })));
  }
}
