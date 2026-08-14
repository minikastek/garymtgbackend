const path = require('path');
const { createConfiguredPool } = require('../../../db/pool');
const { JsonBinderRepository } = require('./json');
const { PostgresBinderRepository } = require('./postgres');

function createBinderRepository(options = {}) {
  const env = options.env || process.env;
  const driver = String(env.PERSISTENCE_DRIVER || 'json').toLowerCase();
  if (driver === 'json') return new JsonBinderRepository({
    filepath: options.filepath || path.join(__dirname, '..', '..', '..', 'binders.json'),
    now: options.now, idFactory: options.idFactory,
  });
  if (driver === 'postgres') return new PostgresBinderRepository(
    options.pool || createConfiguredPool(env), { idFactory: options.idFactory });
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}

module.exports = { createBinderRepository, JsonBinderRepository, PostgresBinderRepository };
