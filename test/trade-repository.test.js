const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTrade, acceptTrade } = require('../src/repositories/trade/model');
const { JsonTradeRepository } = require('../src/repositories/trade/json');
const { PostgresTradeRepository } = require('../src/repositories/trade/postgres');

function pendingTrade() {
  return createTrade({
    proposerUserId: 'u1',
    recipientUserId: 'u2',
    offeredItems: [{
      binderId: 'b1', cardId: 'ring', name: 'Sol Ring', set: 'c21',
      collectorNumber: '263', quantity: 1, unitValue: 2.5,
      priceSource: 'cardkingdom', priceObservedAt: '2026-08-19T11:59:00.000Z',
    }],
    requestedItems: [{
      binderId: 'b2', cardId: 'lotus', name: 'Black Lotus', set: 'lea',
      collectorNumber: '232', quantity: 1, unitValue: null,
      priceSource: null, priceObservedAt: '2026-08-19T11:59:00.000Z',
    }],
  }, { idFactory: () => 't1', now: () => new Date('2026-08-19T12:00:00Z') });
}

describe('trade repositories', () => {
  it('persists JSON lifecycle changes and participant queries', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'garymtg-trade-'));
    const repository = new JsonTradeRepository({ filepath: path.join(directory, 'trades.json') });
    try {
      const trade = repository.create(pendingTrade());
      const accepted = acceptTrade(trade, 'u2', new Date('2026-08-19T12:05:00Z'));
      repository.replace(accepted);

      assert.equal(repository.findById('t1').status, 'accepted');
      assert.equal(repository.findById('t1').offeredItems[0].unitValue, 2.5);
      assert.equal(repository.findById('t1').offeredItems[0].priceSource, 'cardkingdom');
      assert.deepEqual(repository.listByParticipant('u1').map((item) => item.id), ['t1']);
      assert.deepEqual(repository.listByParticipant('u3'), []);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it('parameterizes PostgreSQL participant queries', async () => {
    const calls = [];
    const pool = { query: async (text, values) => {
      calls.push({ text, values });
      return { rows: [] };
    } };
    await new PostgresTradeRepository(pool).listByParticipant("u1' OR 1=1 --");

    assert.match(calls[0].text, /proposer_user_id = \$1 OR recipient_user_id = \$1/);
    assert.deepEqual(calls[0].values, ["u1' OR 1=1 --"]);
  });

  it('maps PostgreSQL item price snapshots into the trade aggregate', async () => {
    const pool = { query: async (text) => {
      if (text.includes('FROM trade_proposals WHERE id')) {
        return { rows: [{
          id: 't1', proposer_user_id: 'u1', recipient_user_id: 'u2', status: 'pending',
          created_at: '2026-08-19T12:00:00.000Z', updated_at: '2026-08-19T12:00:00.000Z',
        }] };
      }
      return { rows: [{
        proposal_id: 't1', binder_id: 'b1', card_id: 'ring', name: 'Sol Ring',
        set_code: 'c21', collector_number: '263', quantity: 1, unit_value: '2.50',
        price_source: 'cardkingdom', price_observed_at: '2026-08-19T11:59:00.000Z',
        side: 'offered', position: 0,
      }] };
    } };

    const trade = await new PostgresTradeRepository(pool).findById('t1');

    assert.deepEqual(trade.offeredItems, [{
      binderId: 'b1', cardId: 'ring', name: 'Sol Ring', set: 'c21',
      collectorNumber: '263', quantity: 1, unitValue: 2.5,
      priceSource: 'cardkingdom', priceObservedAt: '2026-08-19T11:59:00.000Z',
    }]);
  });

  it('writes PostgreSQL trades and items in one transaction', async () => {
    const calls = [];
    const client = {
      query: async (text, values) => { calls.push({ text, values }); return { rowCount: 1, rows: [] }; },
      release: () => calls.push({ text: 'RELEASE' }),
    };
    const repository = new PostgresTradeRepository({ connect: async () => client });
    await repository.create(pendingTrade());

    assert.equal(calls[0].text, 'BEGIN');
    assert.equal(calls.at(-2).text, 'COMMIT');
    assert.equal(calls.filter((call) => call.text.includes('INSERT INTO trade_proposal_items')).length, 2);
    const offeredInsert = calls.find((call) => call.text.includes('INSERT INTO trade_proposal_items'));
    assert.match(offeredInsert.text, /unit_value, price_source, price_observed_at/);
    assert.deepEqual(offeredInsert.values.slice(4, 11), [
      'Sol Ring', 'c21', '263', 1, 2.5, 'cardkingdom', '2026-08-19T11:59:00.000Z',
    ]);
    assert.equal(calls.at(-1).text, 'RELEASE');
  });
});
