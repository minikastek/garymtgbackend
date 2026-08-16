const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTradeProfileRouter } = require('../routes/trade-profile-router');

async function withServer(repository, test) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1' }; next(); });
  app.use('/api/trade-profile', createTradeProfileRouter(repository));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { await test(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

const currentProfile = {
  userId: 'u1', countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata',
  latitude: null, longitude: null, searchRadiusKm: 25,
  tradeEnabled: false, visibility: 'country',
};

describe('trade profile router', () => {
  it('reads only the authenticated user profile', async () => {
    const requested = [];
    const repository = { findByUserId: async (userId) => { requested.push(userId); return currentProfile; } };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade-profile`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { profile: currentProfile });
      assert.deepEqual(requested, ['u1']);
    });
  });

  it('normalizes and persists an owner update', async () => {
    const saved = [];
    const repository = {
      findByUserId: async () => currentProfile,
      upsert: async (userId, changes) => { saved.push({ userId, changes }); return { ...currentProfile, ...changes }; },
    };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade-profile`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          countryCode: ' ar ', region: ' Buenos Aires ', city: ' La Plata ',
          latitude: -34.92, longitude: -57.95, searchRadiusKm: 50,
          tradeEnabled: true, visibility: 'city',
        }),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).profile.tradeEnabled, true);
      assert.deepEqual(saved[0], {
        userId: 'u1',
        changes: {
          countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata',
          latitude: -34.92, longitude: -57.95, searchRadiusKm: 50,
          tradeEnabled: true, visibility: 'city',
        },
      });
    });
  });

  it('rejects invalid and unexpected fields before persistence', async () => {
    let writes = 0;
    const repository = {
      findByUserId: async () => currentProfile,
      upsert: async () => { writes += 1; },
    };
    const invalidBodies = [
      { countryCode: 'ARG' },
      { visibility: 'precise' },
      { searchRadiusKm: 0 },
      { latitude: -34.92 },
      { tradeEnabled: 'yes' },
      { email: 'not-allowed@example.test' },
    ];
    await withServer(repository, async (baseUrl) => {
      for (const body of invalidBodies) {
        const response = await fetch(`${baseUrl}/api/trade-profile`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        assert.equal(response.status, 400);
      }
      assert.equal(writes, 0);
    });
  });

  it('requires visible location detail before enabling discovery', async () => {
    const repository = {
      findByUserId: async () => ({ ...currentProfile, countryCode: null, region: null, city: null }),
      upsert: async () => { throw new Error('must not write'); },
    };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade-profile`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tradeEnabled: true, visibility: 'city' }),
      });
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'Completa la ubicacion visible antes de activar intercambios' });
    });
  });

  it('returns safe not-found and persistence errors', async () => {
    await withServer({ findByUserId: async () => null }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade-profile`);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Usuario no encontrado' });
    });

    await withServer({ findByUserId: async () => { throw new Error('database detail'); } }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade-profile`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'No se pudo procesar el perfil de intercambio' });
    });
  });
});
