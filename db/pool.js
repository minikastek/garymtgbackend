const { loadRuntimeConfig } = require('../config/runtime');

function loadPoolConstructor() {
  try {
    return require('pg').Pool;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    throw new Error('PostgreSQL commands require the "pg" package. Install it after reconciling package-lock.json.', { cause: error });
  }
}

function createPool(databaseConfig, Pool = loadPoolConstructor()) {
  if (!databaseConfig?.url) throw new Error('DATABASE_URL is required for PostgreSQL commands');
  return new Pool({
    connectionString: databaseConfig.url,
    max: databaseConfig.poolMax,
    idleTimeoutMillis: databaseConfig.idleTimeoutMs,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMs,
    application_name: 'garymtg-backend',
  });
}

function createConfiguredPool(env = process.env, Pool) {
  return createPool(loadRuntimeConfig(env).database, Pool);
}

module.exports = { createConfiguredPool, createPool, loadPoolConstructor };
