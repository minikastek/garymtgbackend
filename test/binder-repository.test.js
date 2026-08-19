const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JsonBinderRepository } = require('../src/repositories/binder/json');
const { PostgresBinderRepository } = require('../src/repositories/binder/postgres');

describe('binder repositories', () => {
  it('persists the JSON lifecycle', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-binder-'));
    const repository = new JsonBinderRepository({ filepath: path.join(directory, 'binders.json'), idFactory: () => 'b1', now: () => new Date('2026-08-14T12:00:00Z') });
    try {
      repository.create({ userId: 'u1', name: 'Trades', description: '' });
      assert.equal(repository.findById('b1').tradeEnabled, false);
      repository.update('b1', { tradeEnabled: true });
      assert.equal(repository.findById('b1').tradeEnabled, true);
      repository.addCard('b1', { id: 'ring', name: 'Sol Ring' }, 2);
      assert.equal(repository.findById('b1').cardCount, 2);
      repository.update('b1', { description: 'Available locally' });
      assert.equal(repository.findById('b1').description, 'Available locally');
      assert.equal(repository.delete('b1'), true);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('parameterizes PostgreSQL lookups', async () => {
    const calls = [];
    const pool = { query: async (text, values) => {
      calls.push({ text, values });
      return { rows: text.includes('FROM collections') ? [{ id: 'b1', user_id: 'u1', name: 'Trades', description: '', created_at: '2026-08-14T12:00:00Z', updated_at: '2026-08-14T12:00:00Z' }] : [] };
    } };
    await new PostgresBinderRepository(pool).findById("b1' OR 1=1 --");
    assert.match(calls[0].text, /id = \$1/);
    assert.deepEqual(calls[0].values, ["b1' OR 1=1 --"]);
  });
});
