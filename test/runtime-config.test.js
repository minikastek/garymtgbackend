const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DEVELOPMENT_JWT_SECRET, loadRuntimeConfig } = require('../config/runtime');
const { createPool } = require('../db/pool');

describe('runtime config', () => {
  it('preserves development defaults', () => {
    const config = loadRuntimeConfig({});
    assert.equal(config.port, 3001);
    assert.equal(config.jwtSecret, DEVELOPMENT_JWT_SECRET);
    assert.equal(config.database.url, null);
  });
  it('requires an explicit production JWT secret', () => {
    assert.throws(() => loadRuntimeConfig({ NODE_ENV: 'production' }), /JWT_SECRET is required in production/);
  });
  it('rejects invalid numeric settings', () => {
    assert.throws(() => loadRuntimeConfig({ DATABASE_POOL_MAX: '0' }), /positive integer/);
  });
  it('creates a pool without connecting eagerly', () => {
    let options;
    class FakePool { constructor(value) { options = value; } }
    const pool = createPool({ url: 'postgresql://localhost/garymtg', poolMax: 8, idleTimeoutMs: 20, connectionTimeoutMs: 10 }, FakePool);
    assert.ok(pool instanceof FakePool);
    assert.equal(options.max, 8);
    assert.equal(options.application_name, 'garymtg-backend');
  });
});
