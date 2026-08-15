const path = require('path');
const { createConfiguredPool } = require('../../../db/pool');
const { JsonWishlistRepository } = require('./json');
const { PostgresWishlistRepository } = require('./postgres');

function createWishlistRepository(options = {}) {
  const env = options.env || process.env;
  const driver = String(env.PERSISTENCE_DRIVER || 'json').toLowerCase();
  if (driver === 'json') return new JsonWishlistRepository({
    filepath: options.filepath || path.join(__dirname, '..', '..', '..', 'wishlists.json'),
    now: options.now, idFactory: options.idFactory,
  });
  if (driver === 'postgres') return new PostgresWishlistRepository(
    options.pool || createConfiguredPool(env), { idFactory: options.idFactory });
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}

module.exports = { createWishlistRepository, JsonWishlistRepository, PostgresWishlistRepository };
