const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('events');
const { createTradeRouter } = require('../routes/trade-router');

async function withServer(repository, run) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'me' }; next(); });
  app.use('/api/trade', createTradeRouter(repository));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('trade router', () => {
  it('preserves discovery and reciprocal resource ownership', async () => {
    const repository = {
      searchUsers: async (_query, excludedUserId, limit) => {
        assert.equal(excludedUserId, 'me');
        assert.equal(limit, 20);
        return [{ id: 'u2', username: 'Alice', avatar: 'alice.png' }];
      },
      findUserById: async (id) => id === 'u2' ? { id: 'u2', username: 'Alice' } : null,
      listBindersByUser: async () => [{ id: 'b1', userId: 'u2', name: 'Trades', cards: [{ quantity: 2 }] }],
      findBinderById: async () => ({ id: 'b1', userId: 'u2', name: 'Trades', cards: [{ id: 'c1', name: 'Sol Ring', set: 'MH3', quantity: 2 }] }),
      findWishlistById: async () => ({ id: 'w1', userId: 'me', name: 'Wanted', cards: [{ id: 'c2', name: 'Sol Ring', set: 'C21', quantity: 1 }] }),
    };

    await withServer(repository, async (baseUrl) => {
      const users = await fetch(`${baseUrl}/api/trade/users?q=ali`);
      assert.deepEqual(await users.json(), { users: [{ id: 'u2', username: 'Alice', avatar: 'alice.png' }] });

      const binders = await fetch(`${baseUrl}/api/trade/users/u2/binders`);
      assert.equal((await binders.json()).binders[0].cardCount, 2);

      const comparison = await fetch(`${baseUrl}/api/trade/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'u2', binderId: 'b1', wishlistId: 'w1' }),
      });
      const body = await comparison.json();
      assert.equal(body.matchCount, 1);
      assert.equal(body.matches[0].binderQuantity, 2);
    });
  });

  it('does not expose another user wishlist through comparison', async () => {
    const repository = {
      findUserById: async () => ({ id: 'u2', username: 'Alice' }),
      findBinderById: async () => ({ id: 'b1', userId: 'u2', name: 'Trades', cards: [] }),
      findWishlistById: async () => ({ id: 'w1', userId: 'u3', name: 'Private', cards: [] }),
    };

    await withServer(repository, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'u2', binderId: 'b1', wishlistId: 'w1' }),
      });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Wishlist no encontrada' });
    });
  });
});
