const intervalMs = Number(process.env.MONITOR_INTERVAL_MS ?? 30_000);
const maxFailures = Number(process.env.MONITOR_MAX_FAILURES ?? 3);
const maxIndexerLag = BigInt(process.env.MONITOR_MAX_INDEXER_LAG ?? 20);
const alertWebhook = process.env.ALERT_WEBHOOK_URL;
const targets = [
  { name: "web", url: process.env.WEB_HEALTH_URL ?? "http://web:3000" },
  { name: "api", url: process.env.API_HEALTH_URL ?? "http://api:3001/api/health" },
  { name: "indexer", url: process.env.INDEXER_HEALTH_URL ?? "http://indexer:3002/health" },
];
let consecutiveFailures = 0;
let previousState = "unknown";

const log = (level, event, fields = {}) =>
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...fields }));

async function notify(state, details) {
  if (!alertWebhook || state === previousState) return;
  try {
    await fetch(alertWebhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "pumpnow-testnet-beta", state, details }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    log("error", "monitor.webhook_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}

async function check() {
  const checks = [];
  for (const target of targets) {
    try {
      const response = await fetch(target.url, { signal: AbortSignal.timeout(10_000) });
      const body = await response.json().catch(() => undefined);
      let healthy = response.ok;
      let lag;
      if (target.name === "indexer" && body?.checks) {
        const indexed = BigInt(body.checks.latestIndexedBlock ?? 0);
        const chain = BigInt(body.checks.latestChainBlock ?? 0);
        lag = chain > indexed ? chain - indexed : 0n;
        healthy = healthy && body.checks.worker === "running" && lag <= maxIndexerLag;
      }
      checks.push({ name: target.name, healthy, status: response.status, lag: lag?.toString() });
    } catch (error) {
      checks.push({ name: target.name, healthy: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const healthy = checks.every((item) => item.healthy);
  consecutiveFailures = healthy ? 0 : consecutiveFailures + 1;
  const state = healthy ? "healthy" : "degraded";
  log(healthy ? "info" : "error", "monitor.check", { state, consecutiveFailures, checks });
  await notify(state, checks);
  previousState = state;
  if (consecutiveFailures >= maxFailures)
    throw new Error(`Health checks failed ${consecutiveFailures} consecutive times`);
}

if (!Number.isFinite(intervalMs) || intervalMs < 5_000) throw new Error("MONITOR_INTERVAL_MS must be at least 5000");
if (!Number.isInteger(maxFailures) || maxFailures < 1) throw new Error("MONITOR_MAX_FAILURES must be a positive integer");

for (;;) {
  await check();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
