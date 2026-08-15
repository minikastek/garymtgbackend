const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonTradeRepository } = require('../src/repositories/trade/json');
const { PostgresTradeRepository } = require('../src/repositories/trade/postgres');

describe('trade repositories', () => {
  it('reads users and collections through the JSON adapter', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-trade-'));
    const files = {
      usersPath: path.join(directory, 'users.json'),
      bindersPath: path.join(directory, 'binders.json'),
      wishlistsPath: path.join(directory, 'wishlists.json'),
    };
    fs.writeFileSync(files.usersPath, JSON.stringify([
      { id: 'me', username: 'Me' },
      { id: 'u2', username: 'Alice', avatar: 'alice.png' },
    ]));
    fs.writeFileSync(files.bindersPath, JSON.stringify([
      { id: 'b1', userId: 'u2', name: 'Trades', cards: [{ id: 'c1', name: 'Sol Ring', quantity: 2 }] },
    ]));
    fs.writeFileSync(files.wishlistsPath, JSON.stringify([
      { id: 'w1', userId: 'me', name: 'Wanted', cards: [{ id: 'c2', name: 'Sol Ring', quantity: 1 }] },
    ]));

    const repository = new JsonTradeRepository(files);
    assert.deepEqual((await repository.searchUsers('lic', 'me')).map((user) => user.id), ['u2']);
    assert.equal((await repository.listBindersByUser('u2'))[0].id, 'b1');
    assert.equal((await repository.findWishlistById('w1')).userId, 'me');
  });

  it('parameterizes PostgreSQL user discovery and delegates collections', async () => {
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push({ text, params });
        return { rows: [{ id: 'u2', username: 'Alice', avatar: 'alice.png' }] };
      },
    };
    const repository = new PostgresTradeRepository({
      pool,
      binderRepository: { listByUser: async () => [{ id: 'b1' }], findById: async () => ({ id: 'b1' }) },
      wishlistRepository: { findById: async () => ({ id: 'w1' }) },
    });

    assert.equal((await repository.searchUsers('ALI', 'me', 100))[0].username, 'Alice');
    assert.deepEqual(queries[0].params, ['me', '%ali%', 20]);
    assert.match(queries[0].text, /LIMIT \$3/);
    assert.equal((await repository.listBindersByUser('u2'))[0].id, 'b1');
  });
});
