const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonTradeProfileRepository } = require('../src/repositories/trade-profile/json');
const { PostgresTradeProfileRepository } = require('../src/repositories/trade-profile/postgres');
const { normalizeTradeProfile } = require('../src/repositories/trade-profile/model');

describe('trade profile repositories', () => {
  it('normalizes privacy and coordinate constraints', () => {
    assert.deepEqual(normalizeTradeProfile({
      userId: 'u1', countryCode: ' ar ', region: ' Buenos Aires ', city: ' La Plata ',
      latitude: -34.92, longitude: -57.95, searchRadiusKm: 900,
      tradeEnabled: true, visibility: 'city',
    }), {
      userId: 'u1', countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata',
      latitude: -34.92, longitude: -57.95, searchRadiusKm: 500,
      tradeEnabled: true, visibility: 'city', updatedAt: undefined,
    });
    assert.equal(normalizeTradeProfile({ userId: 'u1', latitude: 1 }).latitude, null);
    assert.equal(normalizeTradeProfile({ userId: 'u1', visibility: 'precise' }).visibility, 'country');
  });

  it('persists an opt-in profile in the JSON user record', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-trade-profile-'));
    const filepath = path.join(directory, 'users.json');
    fs.writeFileSync(filepath, JSON.stringify([{ id: 'u1', username: 'Alice', password: 'hash' }]));
    const repository = new JsonTradeProfileRepository({
      filepath,
      now: () => new Date('2026-08-16T00:00:00Z'),
    });

    try {
      const profile = repository.upsert('u1', {
        countryCode: 'ar', region: 'Buenos Aires', city: 'La Plata',
        tradeEnabled: true, visibility: 'region', searchRadiusKm: 50,
      });
      assert.equal(profile.visibility, 'region');
      assert.equal(repository.findByUserId('u1').tradeEnabled, true);
      const storedUser = JSON.parse(fs.readFileSync(filepath, 'utf8'))[0];
      assert.equal(storedUser.password, 'hash');
      assert.equal(storedUser.tradeProfile.countryCode, 'AR');
      assert.equal(repository.upsert('missing', { tradeEnabled: true }), null);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('uses parameterized PostgreSQL reads and upserts', async () => {
    const calls = [];
    const row = {
      user_id: 'u1', country_code: 'AR', region: 'Buenos Aires', city: 'La Plata',
      latitude: '-34.92', longitude: '-57.95', search_radius_km: 25,
      trade_enabled: true, location_visibility: 'city', updated_at: '2026-08-16T00:00:00Z',
    };
    const pool = { query: async (text, values) => {
      calls.push({ text, values });
      return { rows: [row] };
    } };
    const repository = new PostgresTradeProfileRepository(pool);

    const found = await repository.findByUserId("u1' OR 1=1 --");
    const saved = await repository.upsert('u1', {
      countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata',
      latitude: -34.92, longitude: -57.95, searchRadiusKm: 25,
      tradeEnabled: true, visibility: 'city',
    });

    assert.equal(found.visibility, 'city');
    assert.equal(saved.latitude, -34.92);
    assert.match(calls[0].text, /u\.id = \$1/);
    assert.deepEqual(calls[0].values, ["u1' OR 1=1 --"]);
    assert.match(calls[1].text, /ON CONFLICT \(user_id\)/);
    assert.deepEqual(calls[1].values, ['u1', 'AR', 'Buenos Aires', 'La Plata', -34.92, -57.95, 25, true, 'city']);
  });
});
