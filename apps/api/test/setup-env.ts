process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/pumpnow';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.API_PORT ??= '3001';
