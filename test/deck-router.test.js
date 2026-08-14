const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createDeckRouter } = require('../routes/deck-router');

async function withServer(repository, test) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1' }; next(); });
  app.use('/api/decks', createDeckRouter(repository));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { await test(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

describe('deck router', () => {
  it('preserves ownership enforcement', async () => {
    await withServer({ findById: async () => ({ id: 'd2', userId: 'u2', main: [], sideboard: [] }) }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/decks/d2`);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'No es tu deck' });
    });
  });

  it('rejects more than four non-basic copies before persistence', async () => {
    let saves = 0;
    const repository = {
      findById: async () => ({ id: 'd1', userId: 'u1', name: 'Burn', main: [{ id: 'bolt', name: 'Lightning Bolt', type: 'Instant', quantity: 4 }], sideboard: [] }),
      save: async (deck) => { saves += 1; return deck; },
    };
    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/decks/d1/cards`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ card: { id: 'bolt-2', name: 'Lightning Bolt', type: 'Instant' }, quantity: 1, board: 'sideboard' }),
      });
      assert.equal(response.status, 400);
      assert.equal(saves, 0);
    });
  });
});
