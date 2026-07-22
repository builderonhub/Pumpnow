import { execFileSync } from "node:child_process";

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const indexerUrl = (process.env.INDEXER_URL ?? "http://localhost:3002").replace(/\/$/, "");
const waitMs = Number(process.env.RECOVERY_TIMEOUT_MS ?? "120000");
const testnet = process.argv.includes("--testnet");
const composeArgs = testnet
  ? [
      "--env-file",
      ".env.testnet",
      "-f",
      "docker-compose.yml",
      "-f",
      "docker-compose.testnet.yml",
    ]
  : [];
const docker = (...args) =>
  execFileSync("docker", ["compose", ...composeArgs, ...args], {
    stdio: "inherit",
  });
const dockerContainer = (...args) =>
  execFileSync("docker", args, { stdio: "inherit" });
const dockerContainerOutput = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitContainer = async (args, predicate) => {
  const deadline = Date.now() + waitMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const output = dockerContainerOutput(...args);
      if (predicate(output)) return output;
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(
    `Timed out waiting for docker ${args.join(" ")}: ${lastError ?? "condition not met"}`,
  );
};
const waitJson = async (url, predicate) => {
  const deadline = Date.now() + waitMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.json();
        if (predicate(body)) return body;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError ?? "condition not met"}`);
};
const waitSseEvent = async (expected, afterConnect) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${apiUrl}/api/realtime/events`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`SSE HTTP ${response.status}`);
    if (afterConnect) await afterConnect();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    try {
      while (!text.includes(expected)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    }
    if (!text.includes(expected))
      throw new Error(`SSE event was not received: ${expected}`);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};

// These infrastructure services have fixed container names and may have been
// created by a previous Compose project. Reuse them instead of deleting data
// or trying to create a conflicting container.
dockerContainer("start", "pumpnow-redis");
await waitContainer(
  ["exec", "pumpnow-redis", "redis-cli", "ping"],
  (output) => output.trim() === "PONG",
);
const before = await waitJson(`${indexerUrl}/health`, (body) => body.checks?.worker === "running");
console.log(`Baseline checkpoint=${before.checks.latestIndexedBlock ?? "none"}`);

docker("restart", "indexer");
const afterIndexer = await waitJson(
  `${indexerUrl}/health`,
  (body) => body.checks?.worker === "running" && BigInt(body.checks.latestIndexedBlock ?? 0) >= BigInt(before.checks.latestIndexedBlock ?? 0),
);
console.log(`PASS indexer restart checkpoint=${afterIndexer.checks.latestIndexedBlock ?? "none"}`);

dockerContainer("restart", "pumpnow-redis");
await waitContainer(
  ["exec", "pumpnow-redis", "redis-cli", "ping"],
  (output) => output.trim() === "PONG",
);
await waitJson(`${apiUrl}/api/health`, (body) => body.checks?.redis === "up");
await waitSseEvent("recovery-probe", async () => {
  await sleep(1000);
  dockerContainer("exec", "pumpnow-redis", "redis-cli", "publish", "pumpnow:realtime", JSON.stringify({
    type: "stats.updated",
    transactionHash: "recovery-probe",
    occurredAt: new Date().toISOString(),
  }));
});
console.log("PASS Redis restart and SSE recovery");

docker("restart", "api");
await waitJson(`${apiUrl}/api/health`, (body) => body.status === "ok");
await waitSseEvent("api-recovery-probe", async () => {
  await sleep(1000);
  dockerContainer(
    "exec",
    "pumpnow-redis",
    "redis-cli",
    "publish",
    "pumpnow:realtime",
    JSON.stringify({
      type: "stats.updated",
      transactionHash: "api-recovery-probe",
      occurredAt: new Date().toISOString(),
    }),
  );
});
console.log("PASS API restart and SSE reconnect");

dockerContainer("stop", "pumpnow-postgres");
await sleep(2000);
dockerContainer("start", "pumpnow-postgres");
await waitContainer(
  ["exec", "pumpnow-postgres", "pg_isready", "-U", "postgres", "-d", testnet ? "pumpnow_testnet" : "pumpnow"],
  (output) => output.includes("accepting connections"),
);
// Run the checked-in migration CLI against DATABASE_URL from the selected env
// file. `compose run migrate` would try to recreate fixed-name infrastructure
// containers when they originated under a different Compose project.
execFileSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "packages/database/prisma/schema.prisma",
  ],
  { stdio: "inherit" },
);
await waitJson(`${apiUrl}/api/health`, (body) => body.checks?.postgres === "up");
await waitJson(`${indexerUrl}/health`, (body) => body.checks?.worker === "running");
console.log("PASS PostgreSQL restart, migrations and reconnect");

execFileSync(
  process.execPath,
  [
    `--env-file-if-exists=${testnet ? ".env.testnet" : ".env"}`,
    "scripts/stress-audit.mjs",
  ],
  { stdio: "inherit" },
);
console.log("Restart/recovery suite PASS");
