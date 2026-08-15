const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildImportModel, importModel } = require('../db/import-json');

describe('JSON to PostgreSQL import', () => {
  it('normalizes users and all collection types', () => {
    const model = buildImportModel({
      users: [{ id: 'u1', username: 'gary', passwordHash: 'hash', createdAt: '2026-01-01T00:00:00Z' }],
      decks: [{ id: 'd1', userId: 'u1', name: 'Burn', main: [{ id: 'bolt', name: 'Lightning Bolt', quantity: 4 }], sideboard: [{ id: 'moon', name: 'Blood Moon', quantity: 2 }] }],
      binders: [{ id: 'b1', userId: 'u1', name: 'Trades', cards: [] }],
      wishlists: [{ id: 'w1', userId: 'u1', name: 'Wanted', cards: [] }],
    });
    assert.equal(model.users.length, 1);
    assert.deepEqual(model.collections.map((item) => item.type), ['deck', 'binder', 'wishlist']);
    assert.deepEqual(model.collections[0].cards.map((card) => card.board), ['main', 'sideboard']);
  });

  it('uses a transaction and replaces collection cards idempotently', async () => {
    const queries = [];
    const client = { query: async (text, values) => { queries.push({ text, values }); return { rows: [] }; }, release() {} };
    const model = buildImportModel({
      users: [{ id: 'u1', username: 'gary', passwordHash: 'hash' }],
      binders: [{ id: 'b1', userId: 'u1', name: 'Trades', cards: [{ id: 'ring', name: 'Sol Ring', quantity: 2 }] }],
    });
    await importModel({ connect: async () => client }, model);
    assert.equal(queries[0].text, 'BEGIN');
    assert.ok(queries.some((query) => query.text.startsWith('DELETE FROM collection_cards')));
    assert.equal(queries.at(-1).text, 'COMMIT');
  });

  it('rolls back when persistence fails', async () => {
    const queries = [];
    const client = {
      query: async (text) => { queries.push(text); if (text.includes('INSERT INTO users')) throw new Error('database unavailable'); return { rows: [] }; },
      release() {},
    };
    await assert.rejects(importModel(
      { connect: async () => client },
      buildImportModel({ users: [{ id: 'u1', username: 'gary', passwordHash: 'hash' }] }),
    ), /database unavailable/);
    assert.equal(queries.at(-1), 'ROLLBACK');
  });
});
