"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
type Payload = { tokenAddress?: string };
export function RealtimeSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const source = new EventSource(`${API_URL}/api/realtime/events`);
    const refresh = (event: MessageEvent<string>) => {
      let payload: Payload;
      try { payload = JSON.parse(event.data) as Payload; } catch { return; }
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      if (payload.tokenAddress) {
        const address = payload.tokenAddress.toLowerCase();
        for (const key of ["token", "trades", "holders", "candles"]) void queryClient.invalidateQueries({ queryKey: [key, address] });
      }
    };
    for (const name of ["sync.required", "token.created", "token.updated", "trade.created", "stats.updated"]) source.addEventListener(name, refresh as EventListener);
    return () => source.close();
  }, [queryClient]);
  return null;
}
