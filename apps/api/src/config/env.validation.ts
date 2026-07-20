type Environment = Record<string, unknown>;

function requiredString(env: Environment, key: string): string {
  const value = env[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function port(env: Environment, key: string, fallback: number): number {
  const value = Number(env[key] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${key} must be a valid TCP port`);
  }
  return value;
}

export function validateEnvironment(env: Environment): Environment {
  const databaseUrl = requiredString(env, 'DATABASE_URL');
  const redisUrl = requiredString(env, 'REDIS_URL');
  new URL(databaseUrl);
  new URL(redisUrl);

  const corsOrigins = requiredString(env, 'CORS_ORIGINS');
  for (const origin of corsOrigins.split(',')) new URL(origin.trim());

  return {
    ...env,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    CORS_ORIGINS: corsOrigins,
    API_PORT: port(env, 'API_PORT', 3001),
  };
}
