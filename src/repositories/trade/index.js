const { loadRuntimeConfig } = require('../../../config/runtime');
const { createPool } = require('../../../db/pool');
const { JsonTradeRepository } = require('./json');
const { PostgresTradeRepository } = require('./postgres');

function createTradeRepository({ driver, pool } = {}) {
  const config = loadRuntimeConfig();
  const persistenceDriver = driver || process.env.PERSISTENCE_DRIVER || 'json';
  if (persistenceDriver === 'postgres') {
    return new PostgresTradeRepository({ pool: pool || createPool(config.database) });
  }
  return new JsonTradeRepository();
}

module.exports = { createTradeRepository };
