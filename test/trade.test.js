const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTradeRouter, tradableBinders } = require('../routes/trade');

async function withTradeServer(fixtures, test, binderRepository = {}, wishlistRepository = {}, tradeOptions = {}) {
  const jsonLoader = (file) => {
    const name = ['users', 'binders', 'wishlists'].find((item) => String(file).endsWith(`${item}.json`));
    return fixtures[name] || [];
  };
  const repository = {
    listByUser: async (userId) => (fixtures.binders || []).filter((binder) => binder.userId === userId),
    findById: async (id) => (fixtures.binders || []).find((binder) => binder.id === id) || null,
    ...binderRepository,
  };
  const configuredWishlistRepository = {
    findById: async (id) => (fixtures.wishlists || []).find((wishlist) => wishlist.id === id) || null,
    ...wishlistRepository,
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'u1' }; next(); });
  app.use('/api/trade', createTradeRouter({
    binderRepository: repository,
    wishlistRepository: configuredWishlistRepository,
    jsonLoader,
    ...tradeOptions,
  }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try { await test(`http://127.0.0.1:${server.address().port}`); }
  finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function cardKey(name) {
  return String(name || '')
    .toLowerCase()
    .split(' // ')[0]
    .trim();
}

describe('trade name match', () => {
  it('ignora edición y normaliza nombre', () => {
    assert.equal(cardKey('Lightning Bolt'), cardKey('Lightning Bolt'));
    assert.equal(cardKey('Lightning Bolt'), 'lightning bolt');
    assert.equal(cardKey('Emeritus // Lightning Bolt'), 'emeritus');
  });

  it('detecta match binder vs wishlist por nombre', () => {
    const wishlist = [{ name: 'Sol Ring', set: 'C21', quantity: 1 }];
    const binder = [
      { name: 'Sol Ring', set: 'MH3', quantity: 2 },
      { name: 'Counterspell', set: 'MH2', quantity: 1 },
    ];
    const wanted = new Set(wishlist.map((c) => cardKey(c.name)));
    const matches = binder.filter((c) => wanted.has(cardKey(c.name)));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].set, 'MH3');
  });

  it('exposes only binders explicitly enabled for trade', () => {
    const binders = [
      { id: 'private', userId: 'u2', name: 'Private', cards: [{ quantity: 4 }] },
      { id: 'public', userId: 'u2', name: 'Trades', tradeEnabled: true, cards: [{ quantity: 2 }] },
      { id: 'other', userId: 'u3', name: 'Other', tradeEnabled: true, cards: [] },
    ];

    assert.deepEqual(tradableBinders(binders, 'u2'), [{
      id: 'public', name: 'Trades', description: '', cardCount: 2,
    }]);
  });

  it('loads tradable binder summaries through the configured repository', async () => {
    let requestedUserId;
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/users/u2/binders`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).binders, [{
        id: 'public', name: 'Trades', description: '', cardCount: 2,
      }]);
    }, {
      listByUser: async (userId) => {
        requestedUserId = userId;
        return [{
          id: 'public', userId: 'u2', name: 'Trades', tradeEnabled: true,
          cards: [{ quantity: 2 }],
        }];
      },
    });
    assert.equal(requestedUserId, 'u2');
  });

  it('loads the authenticated wishlist through the configured repository', async () => {
    let requestedWishlistId;
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [{ id: 'public', userId: 'u2', name: 'Trades', tradeEnabled: true, cards: [] }],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/compare`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'u2', binderId: 'public', wishlistId: 'wanted' }),
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.wishlist.id, 'wanted');
      assert.equal(body.matchCount, 0);
    }, {}, {
      findById: async (id) => {
        requestedWishlistId = id;
        return { id: 'wanted', userId: 'u1', name: 'Wanted', description: '', cards: [] };
      },
    });
    assert.equal(requestedWishlistId, 'wanted');
  });

  it('rejects a repository wishlist owned by another player', async () => {
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [{ id: 'public', userId: 'u2', name: 'Trades', tradeEnabled: true, cards: [] }],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/compare`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'u2', binderId: 'public', wishlistId: 'other' }),
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Wishlist no encontrada' });
    }, {}, {
      findById: async () => ({ id: 'other', userId: 'u3', name: 'Private', cards: [] }),
    });
  });

  it('rejects direct comparison against a private binder id', async () => {
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [{
        id: 'private', userId: 'u2', name: 'Private', tradeEnabled: false,
        cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }],
      }],
      wishlists: [{
        id: 'wanted', userId: 'u1', name: 'Wanted',
        cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }],
      }],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/compare`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'u2', binderId: 'private', wishlistId: 'wanted' }),
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Binder no encontrado' });
    });
  });

  it('creates a pending proposal from server-owned cards and authoritative prices', async () => {
    let persisted;
    const observedAt = '2026-09-01T02:30:00.000Z';
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [
        {
          id: 'mine', userId: 'u1', name: 'My trades', cards: [{
            id: 'ring', name: 'Sol Ring', set: 'C21', collectorNumber: '263', quantity: 2,
            prices: { scryfallUsd: 1.5 },
          }],
        },
        {
          id: 'theirs', userId: 'u2', name: 'Bob trades', tradeEnabled: true, cards: [{
            id: 'lotus', name: 'Lotus Petal', set: 'TMP', collectorNumber: '294', quantity: 1,
            prices: { scryfallUsd: 12 },
          }],
        },
      ],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/proposals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: 'u2',
          offeredItems: [{ binderId: 'mine', cardId: 'ring', quantity: 1, unitValue: 999 }],
          requestedItems: [{ binderId: 'theirs', cardId: 'lotus', quantity: 1 }],
        }),
      });

      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.trade.status, 'pending');
      assert.equal(body.trade.offeredItems[0].unitValue, 2.5);
      assert.equal(body.trade.requestedItems[0].unitValue, 12);
    }, {}, {}, {
      tradeRepository: { create: async (trade) => { persisted = trade; return trade; } },
      priceResolver: async (card) => card.id === 'ring'
        ? { unitValue: 2.5, priceSource: 'cardkingdom' }
        : { unitValue: 12, priceSource: 'scryfall' },
      now: () => new Date(observedAt),
    });

    assert.equal(persisted.proposerUserId, 'u1');
    assert.equal(persisted.recipientUserId, 'u2');
    assert.deepEqual(persisted.offeredItems[0], {
      binderId: 'mine', cardId: 'ring', name: 'Sol Ring', set: 'C21',
      collectorNumber: '263', quantity: 1, unitValue: 2.5,
      priceSource: 'cardkingdom', priceObservedAt: observedAt,
    });
  });

  it('rejects proposal quantities beyond the server-owned binder balance', async () => {
    let createCalls = 0;
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [
        { id: 'mine', userId: 'u1', cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }] },
        {
          id: 'theirs', userId: 'u2', tradeEnabled: true,
          cards: [{ id: 'lotus', name: 'Lotus Petal', quantity: 1 }],
        },
      ],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/proposals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: 'u2',
          offeredItems: [{ binderId: 'mine', cardId: 'ring', quantity: 2 }],
          requestedItems: [{ binderId: 'theirs', cardId: 'lotus', quantity: 1 }],
        }),
      });

      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'Cantidad de cartas no disponible' });
    }, {}, {}, {
      tradeRepository: { create: async () => { createCalls += 1; } },
      priceResolver: async () => ({ unitValue: null, priceSource: null }),
    });
    assert.equal(createCalls, 0);
  });

  it('rejects duplicate item rows that cumulatively exceed the binder balance', async () => {
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [
        { id: 'mine', userId: 'u1', cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }] },
        {
          id: 'theirs', userId: 'u2', tradeEnabled: true,
          cards: [{ id: 'lotus', name: 'Lotus Petal', quantity: 1 }],
        },
      ],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/proposals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: 'u2',
          offeredItems: [
            { binderId: 'mine', cardId: 'ring', quantity: 1 },
            { binderId: 'mine', cardId: 'ring', quantity: 1 },
          ],
          requestedItems: [{ binderId: 'theirs', cardId: 'lotus', quantity: 1 }],
        }),
      });

      assert.equal(response.status, 409);
      assert.deepEqual(await response.json(), { error: 'Cantidad de cartas no disponible' });
    }, {}, {}, {
      tradeRepository: { create: async () => assert.fail('proposal must not persist') },
      priceResolver: async () => ({ unitValue: null, priceSource: null }),
    });
  });

  it('rejects requested cards from a binder that is not public for trade', async () => {
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [
        { id: 'mine', userId: 'u1', cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }] },
        {
          id: 'private', userId: 'u2', tradeEnabled: false,
          cards: [{ id: 'lotus', name: 'Lotus Petal', quantity: 1 }],
        },
      ],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/proposals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: 'u2',
          offeredItems: [{ binderId: 'mine', cardId: 'ring', quantity: 1 }],
          requestedItems: [{ binderId: 'private', cardId: 'lotus', quantity: 1 }],
        }),
      });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Cartas de intercambio no disponibles' });
    }, {}, {}, {
      tradeRepository: { create: async () => assert.fail('proposal must not persist') },
      priceResolver: async () => ({ unitValue: null, priceSource: null }),
    });
  });

  it('returns a safe JSON error when proposal persistence fails', async () => {
    await withTradeServer({
      users: [{ id: 'u1', username: 'Alice' }, { id: 'u2', username: 'Bob' }],
      binders: [
        { id: 'mine', userId: 'u1', cards: [{ id: 'ring', name: 'Sol Ring', quantity: 1 }] },
        {
          id: 'theirs', userId: 'u2', tradeEnabled: true,
          cards: [{ id: 'lotus', name: 'Lotus Petal', quantity: 1 }],
        },
      ],
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/trade/proposals`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: 'u2',
          offeredItems: [{ binderId: 'mine', cardId: 'ring', quantity: 1 }],
          requestedItems: [{ binderId: 'theirs', cardId: 'lotus', quantity: 1 }],
        }),
      });

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'No se pudo crear la propuesta' });
    }, {}, {}, {
      tradeRepository: { create: async () => { throw new Error('database details'); } },
      priceResolver: async () => ({ unitValue: null, priceSource: null }),
    });
  });
});
