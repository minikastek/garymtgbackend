const path = require('path');
const { createConfiguredPool } = require('../../../db/pool');
const { JsonTradeRepository } = require('./json');
const { PostgresTradeRepository } = require('./postgres');

function createTradeRepository(options = {}) {
  const env = options.env || process.env;
  const driver = String(env.PERSISTENCE_DRIVER || 'json').toLowerCase();
  if (driver === 'json') return new JsonTradeRepository({
    filepath: options.filepath || path.join(__dirname, '..', '..', '..', 'trades.json'),
  });
  if (driver === 'postgres') return new PostgresTradeRepository(
    options.pool || createConfiguredPool(env));
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}

module.exports = { createTradeRepository, JsonTradeRepository, PostgresTradeRepository };
