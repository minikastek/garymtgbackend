const path = require('path');
const { createConfiguredPool } = require('../../../db/pool');
const { JsonDeckRepository } = require('./json');
const { PostgresDeckRepository } = require('./postgres');

function createDeckRepository(options = {}) {
  const env = options.env || process.env;
  const driver = String(env.PERSISTENCE_DRIVER || 'json').toLowerCase();
  if (driver === 'json') return new JsonDeckRepository({
    filepath: options.filepath || path.join(__dirname, '..', '..', '..', 'decks.json'),
    now: options.now, idFactory: options.idFactory,
  });
  if (driver === 'postgres') return new PostgresDeckRepository(
    options.pool || createConfiguredPool(env), { idFactory: options.idFactory });
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}

module.exports = { createDeckRepository, JsonDeckRepository, PostgresDeckRepository };
