import { readFile, writeFile } from "node:fs/promises";

const path = "contracts/broadcast/DeployPumpDexTestnet.s.sol/5042002/run-latest.json";
const deployment = JSON.parse(await readFile(path, "utf8"));
const created = deployment.transactions?.filter((tx) => tx.transactionType === "CREATE") ?? [];
const factory = created.find((tx) => tx.contractName === "PumpFactory")?.contractAddress;
const adapter = created.find((tx) => tx.contractName === "PumpDexAdapter")?.contractAddress;
const dex = created.find((tx) => tx.contractName === "PumpDexFactory")?.contractAddress;
if (!factory || !adapter || !dex) throw new Error(`PumpFactory/PumpDexAdapter/PumpDexFactory not found in ${path}`);

const envPath = ".env.testnet";
let env = await readFile(envPath, "utf8");
const set = (key, value) => {
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
};
set("PUMP_FACTORY_ADDRESS", factory);
set("NEXT_PUBLIC_PUMP_FACTORY_ADDRESS", factory);
set("DEX_ADAPTER_ADDRESS", adapter);
set("PUMP_DEX_FACTORY_ADDRESS", dex);
set("INDEXER_START_BLOCK", String(deployment.receipts?.[0]?.blockNumber ?? ""));
await writeFile(envPath, env);
console.log(`Updated ${envPath}`);
console.log(`PumpFactory=${factory}`);
console.log(`PumpDexAdapter=${adapter}`);
console.log(`PumpDexFactory=${dex}`);
