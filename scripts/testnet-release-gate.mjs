import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const npmCli = process.env.npm_execpath;
const results = [];

function command(label, executable, args, cwd = root) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(executable, args, { cwd, env: process.env, stdio: "inherit" });
  const passed = result.status === 0;
  results.push({
    label,
    passed,
    detail: result.error instanceof Error ? result.error.message : undefined,
  });
  return passed;
}

function npmCommand(label, args) {
  if (!npmCli) {
    results.push({ label, passed: false, detail: "npm_execpath is unavailable" });
    return false;
  }
  return command(label, process.execPath, [npmCli, ...args]);
}

async function health(label, value, path) {
  if (!value) {
    results.push({ label, passed: false, detail: "URL is not configured" });
    return;
  }
  const url = new URL(path, value.endsWith("/") ? value : `${value}/`);
  if (["localhost", "127.0.0.1"].includes(url.hostname)) {
    results.push({ label, passed: false, detail: "public URL still points to localhost" });
    return;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    results.push({ label, passed: response.ok, detail: `${response.status} ${url}` });
  } catch (error) {
    results.push({ label, passed: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

command("Foundry format", "forge", ["fmt", "--check"], `${root}/contracts`);
command("Foundry regression", "forge", ["test"], `${root}/contracts`);
npmCommand("npm lint", ["run", "lint", "--", "--force"]);
npmCommand("npm typecheck", ["run", "typecheck", "--", "--force"]);
npmCommand("npm tests", ["run", "test", "--", "--force"]);
npmCommand("production build", ["run", "build", "--", "--force"]);
npmCommand("testnet preflight", ["run", "testnet:preflight"]);

const manifest = readFileSync(`${root}/docs/testnet-deployment-manifest.md`, "utf8");
results.push({
  label: "deployment manifest",
  passed: !manifest.includes("`PENDING`"),
  detail: manifest.includes("`PENDING`") ? "manifest still contains PENDING values" : undefined,
});

await health("public API health", process.env.NEXT_PUBLIC_API_URL, "api/health");
await health("public indexer health", process.env.NEXT_PUBLIC_INDEXER_URL, "health");

console.log("\n=== Testnet Beta release gate ===");
for (const result of results)
  console.log(`${result.passed ? "PASS" : "BLOCK"} ${result.label}${result.detail ? ` — ${result.detail}` : ""}`);

const blockers = results.filter((result) => !result.passed);
if (blockers.length > 0) {
  console.error(`\nTestnet Beta is not stable: ${blockers.length} blocker(s) remain.`);
  process.exitCode = 1;
} else {
  console.log("\nAll automated gates passed. Begin/continue the 72-hour observation window.");
}
