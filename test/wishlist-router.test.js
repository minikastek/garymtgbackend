const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createWishlistRouter } = require('../routes/wishlist-router');

async function withServer(repository, test) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1' }; next(); });
  app.use('/api/wishlists', createWishlistRouter(repository));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { await test(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

describe('wishlist router', () => {
  it('preserves validation and create response shape', async () => {
    const repository = { create: async (value) => ({ id: 'w1', ...value, cards: [], cardCount: 0 }) };
    await withServer(repository, async (baseUrl) => {
      const invalid = await fetch(`${baseUrl}/api/wishlists`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: ' ' }) });
      assert.equal(invalid.status, 400);
      const response = await fetch(`${baseUrl}/api/wishlists`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: ' Wanted ' }) });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).wishlist.name, 'Wanted');
    });
  });

  it('preserves ownership enforcement', async () => {
    await withServer({ findById: async () => ({ id: 'w2', userId: 'u2' }) }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/wishlists/w2`);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'No es tu wishlist' });
    });
  });
});
