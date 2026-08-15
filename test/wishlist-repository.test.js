const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonWishlistRepository } = require('../src/repositories/wishlist/json');
const { PostgresWishlistRepository } = require('../src/repositories/wishlist/postgres');

describe('wishlist repositories', () => {
  it('persists the JSON lifecycle', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-wishlist-'));
    const repository = new JsonWishlistRepository({ filepath: path.join(directory, 'wishlists.json'), idFactory: () => 'w1', now: () => new Date('2026-08-14T12:00:00Z') });
    try {
      repository.create({ userId: 'u1', name: 'Wanted', description: '' });
      repository.addCard('w1', { id: 'ring', name: 'Sol Ring' }, 2);
      assert.equal(repository.findById('w1').cardCount, 2);
      repository.setCardQuantity('w1', 'ring', 3);
      assert.equal(repository.findById('w1').cards[0].quantity, 3);
      repository.removeCard('w1', 'ring');
      assert.equal(repository.findById('w1').cardCount, 0);
      assert.equal(repository.delete('w1'), true);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('parameterizes PostgreSQL lookups', async () => {
    const calls = [];
    const pool = { query: async (text, values) => {
      calls.push({ text, values });
      return { rows: text.includes('FROM collections') ? [{ id: 'w1', user_id: 'u1', name: 'Wanted', description: '', created_at: '2026-08-14T12:00:00Z', updated_at: '2026-08-14T12:00:00Z' }] : [] };
    } };
    await new PostgresWishlistRepository(pool).findById("w1' OR 1=1 --");
    assert.match(calls[0].text, /id = \$1/);
    assert.deepEqual(calls[0].values, ["w1' OR 1=1 --"]);
  });
});
