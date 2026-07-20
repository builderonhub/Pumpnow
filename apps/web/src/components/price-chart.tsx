"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaSeries, ColorType, HistogramSeries, createChart, type Time } from "lightweight-charts";
import { api } from "@/lib/api";
import type { CandleInterval } from "@/lib/types";
import { StatePanel } from "./states";
const intervals: CandleInterval[] = ["1m", "5m", "1h"];
export function PriceChart({ tokenAddress }: { tokenAddress: string }) {
  const [interval, setInterval] = useState<CandleInterval>("1m");
  const container = useRef<HTMLDivElement>(null);
  const candles = useQuery({ queryKey: ["candles", tokenAddress, interval], queryFn: () => api.candles(tokenAddress, interval) });
  useEffect(() => {
    if (!container.current || !candles.data?.length) return;
    const chart = createChart(container.current, { autoSize: true, height: 360, layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8f9a91" }, grid: { vertLines: { color: "rgba(255,255,255,.05)" }, horzLines: { color: "rgba(255,255,255,.05)" } }, rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true } });
    const price = chart.addSeries(AreaSeries, { lineColor: "#6dfc8b", topColor: "rgba(109,252,139,.28)", bottomColor: "rgba(109,252,139,0)", lineWidth: 2 });
    price.setData(candles.data.map((item) => ({ time: Math.floor(new Date(item.openTime).getTime() / 1000) as Time, value: Number(item.close) })));
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", color: "rgba(109,252,139,.35)", priceFormat: { type: "volume" } });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(candles.data.map((item) => ({ time: Math.floor(new Date(item.openTime).getTime() / 1000) as Time, value: Number(item.volume), color: Number(item.close) >= Number(item.open) ? "rgba(109,252,139,.45)" : "rgba(255,99,99,.45)" })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles.data]);
  return <div className="price-chart"><div className="chart-toolbar"><div><span className="kicker">PRICE · VOLUME</span><h2>Market activity</h2></div><div className="intervals">{intervals.map((value) => <button key={value} className={interval === value ? "active" : ""} onClick={() => setInterval(value)}>{value}</button>)}</div></div>{candles.isPending ? <div className="chart-loading skeleton" /> : candles.isError ? <StatePanel title="Chart unavailable" message="Candle data could not be loaded." /> : candles.data.length === 0 ? <div className="chart-empty"><b>No market data yet</b><span>The first buy or sell will create this chart.</span></div> : <div ref={container} className="chart-canvas" />}</div>;
}
