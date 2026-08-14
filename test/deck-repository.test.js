const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonDeckRepository } = require('../src/repositories/deck/json');
const { PostgresDeckRepository } = require('../src/repositories/deck/postgres');

describe('deck repositories', () => {
  it('persists board-aware JSON snapshots', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-deck-'));
    const repository = new JsonDeckRepository({ filepath: path.join(directory, 'decks.json'), idFactory: () => 'd1', now: () => new Date('2026-08-14T12:00:00Z') });
    try {
      const deck = repository.create({ userId: 'u1', name: 'Burn' });
      deck.main.push({ id: 'bolt', name: 'Lightning Bolt', type: 'Instant', quantity: 4 });
      deck.sideboard.push({ id: 'moon', name: 'Blood Moon', type: 'Enchantment', quantity: 2 });
      repository.save(deck);
      assert.equal(repository.findById('d1').main[0].quantity, 4);
      assert.equal(repository.findById('d1').sideboard[0].id, 'moon');
      assert.equal(repository.delete('d1'), true);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('parameterizes PostgreSQL deck lookups', async () => {
    const calls = [];
    const pool = { query: async (text, values) => {
      calls.push({ text, values });
      return { rows: text.includes('FROM collections') ? [{ id: 'd1', user_id: 'u1', name: 'Burn', created_at: '2026-08-14T12:00:00Z', updated_at: '2026-08-14T12:00:00Z' }] : [] };
    } };
    await new PostgresDeckRepository(pool).findById("d1' OR 1=1 --");
    assert.match(calls[0].text, /id = \$1/);
    assert.deepEqual(calls[0].values, ["d1' OR 1=1 --"]);
  });
});
