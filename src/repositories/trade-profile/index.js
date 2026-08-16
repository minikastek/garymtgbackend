const path = require('path');
const { createConfiguredPool } = require('../../../db/pool');
const { JsonTradeProfileRepository } = require('./json');
const { PostgresTradeProfileRepository } = require('./postgres');

function createTradeProfileRepository(options = {}) {
  const env = options.env || process.env;
  const driver = String(env.PERSISTENCE_DRIVER || 'json').toLowerCase();
  if (driver === 'json') return new JsonTradeProfileRepository({
    filepath: options.filepath || path.join(__dirname, '..', '..', '..', 'users.json'),
    now: options.now,
  });
  if (driver === 'postgres') {
    return new PostgresTradeProfileRepository(options.pool || createConfiguredPool(env));
  }
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}

module.exports = {
  createTradeProfileRepository,
  JsonTradeProfileRepository,
  PostgresTradeProfileRepository,
};
