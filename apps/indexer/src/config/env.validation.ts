type Environment = Record<string, unknown>;

function required(env: Environment, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function positiveInteger(
  env: Environment,
  key: string,
  fallback: number,
): number {
  const value = Number(env[key] ?? fallback);
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${key} must be a non-negative integer`);
  return value;
}

export function validateEnvironment(env: Environment): Environment {
  const databaseUrl = required(env, "DATABASE_URL");
  const redisUrl = required(env, "REDIS_URL");
  const rpcUrl = required(env, "RPC_URL");
  const factory = required(env, "PUMP_FACTORY_ADDRESS");
  new URL(databaseUrl);
  new URL(redisUrl);
  new URL(rpcUrl);
  if (!/^0x[0-9a-fA-F]{40}$/.test(factory))
    throw new Error("PUMP_FACTORY_ADDRESS must be a 20-byte hex address");
  return {
    ...env,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    RPC_URL: rpcUrl,
    PUMP_FACTORY_ADDRESS: factory,
    CHAIN_ID: positiveInteger(env, "CHAIN_ID", 31337),
    INDEXER_CONFIRMATIONS: positiveInteger(env, "INDEXER_CONFIRMATIONS", 12),
    INDEXER_BLOCK_RANGE: positiveInteger(env, "INDEXER_BLOCK_RANGE", 1000),
  };
}
