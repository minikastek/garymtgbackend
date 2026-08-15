const DEVELOPMENT_JWT_SECRET = 'garymtg-dev-secret';

function positiveInteger(value, fallback, name) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function loadRuntimeConfig(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development').trim();
  const jwtSecret = String(env.JWT_SECRET || '').trim();
  if (nodeEnv === 'production' && !jwtSecret) throw new Error('JWT_SECRET is required in production');

  return Object.freeze({
    nodeEnv,
    port: positiveInteger(env.PORT, 3001, 'PORT'),
    jwtSecret: jwtSecret || DEVELOPMENT_JWT_SECRET,
    database: Object.freeze({
      url: String(env.DATABASE_URL || '').trim() || null,
      poolMax: positiveInteger(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX'),
      idleTimeoutMs: positiveInteger(env.DATABASE_IDLE_TIMEOUT_MS, 30000, 'DATABASE_IDLE_TIMEOUT_MS'),
      connectionTimeoutMs: positiveInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 5000, 'DATABASE_CONNECTION_TIMEOUT_MS'),
    }),
  });
}

module.exports = { DEVELOPMENT_JWT_SECRET, loadRuntimeConfig };
