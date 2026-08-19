const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TRADE_STATUSES,
  createTrade,
  acceptTrade,
  declineTrade,
  cancelTrade,
  updateCoordination,
  confirmTradeCompletion,
} = require('../src/repositories/trade/model');

const firstDate = new Date('2026-08-18T12:00:00.000Z');
const secondDate = new Date('2026-08-18T13:00:00.000Z');

function pendingTrade() {
  return createTrade({
    proposerUserId: 'player-a',
    recipientUserId: 'player-b',
    offeredItems: [{ cardId: 'card-a', quantity: 1 }],
    requestedItems: [{ cardId: 'card-b', quantity: 1 }],
  }, { idFactory: () => 'trade-1', now: () => firstDate });
}

describe('trade lifecycle', () => {
  it('creates a pending immutable proposal with completion fields empty', () => {
    const trade = pendingTrade();
    assert.equal(trade.id, 'trade-1');
    assert.equal(trade.status, TRADE_STATUSES.PENDING);
    assert.equal(trade.proposerCompletedAt, null);
    assert.equal(trade.recipientCompletedAt, null);
    assert.equal(trade.parentTradeId, null);
  });

  it('rejects self trades and proposals without both sides', () => {
    assert.throws(() => createTrade({
      proposerUserId: 'same', recipientUserId: 'same', offeredItems: [{}], requestedItems: [{}],
    }), { code: 'INVALID_PARTICIPANT' });
    assert.throws(() => createTrade({
      proposerUserId: 'a', recipientUserId: 'b', offeredItems: [], requestedItems: [{}],
    }), { code: 'INVALID_ITEMS' });
  });

  it('allows only the recipient to accept or decline a pending proposal', () => {
    assert.throws(() => acceptTrade(pendingTrade(), 'player-a'), { code: 'FORBIDDEN' });
    assert.equal(acceptTrade(pendingTrade(), 'player-b', secondDate).status, TRADE_STATUSES.ACCEPTED);
    assert.equal(declineTrade(pendingTrade(), 'player-b', secondDate).status, TRADE_STATUSES.DECLINED);
  });

  it('allows only the proposer to cancel a pending proposal', () => {
    assert.throws(() => cancelTrade(pendingTrade(), 'player-b'), { code: 'FORBIDDEN' });
    assert.equal(cancelTrade(pendingTrade(), 'player-a', secondDate).status, TRADE_STATUSES.CANCELLED);
  });

  it('stores private coordination for accepted trade participants', () => {
    const accepted = acceptTrade(pendingTrade(), 'player-b', secondDate);
    const coordinated = updateCoordination(accepted, 'player-a', {
      method: 'in_person', notes: 'Meet at the local game store.',
    }, secondDate);
    assert.deepEqual(coordinated.coordination, {
      method: 'in_person', notes: 'Meet at the local game store.',
    });
    assert.throws(() => updateCoordination(accepted, 'outsider', { method: 'other' }), { code: 'FORBIDDEN' });
    assert.throws(() => updateCoordination(accepted, 'player-a', { method: 'teleport' }), { code: 'INVALID_COORDINATION' });
  });

  it('keeps the trade accepted after the first completion confirmation', () => {
    const accepted = acceptTrade(pendingTrade(), 'player-b', secondDate);
    const confirmed = confirmTradeCompletion(accepted, 'player-a', secondDate);
    assert.equal(confirmed.status, TRADE_STATUSES.ACCEPTED);
    assert.equal(confirmed.proposerCompletedAt, secondDate.toISOString());
    assert.equal(confirmed.recipientCompletedAt, null);
    assert.throws(() => updateCoordination(confirmed, 'player-b', { method: 'shipping' }), { code: 'COORDINATION_LOCKED' });
  });

  it('completes only after both participants confirm', () => {
    const accepted = acceptTrade(pendingTrade(), 'player-b', secondDate);
    const proposerConfirmed = confirmTradeCompletion(accepted, 'player-a', secondDate);
    const completed = confirmTradeCompletion(proposerConfirmed, 'player-b', firstDate);
    assert.equal(completed.status, TRADE_STATUSES.COMPLETED);
    assert.equal(completed.completedAt, firstDate.toISOString());
  });

  it('treats a repeated completion confirmation as idempotent', () => {
    const accepted = acceptTrade(pendingTrade(), 'player-b', secondDate);
    const confirmed = confirmTradeCompletion(accepted, 'player-a', secondDate);
    assert.deepEqual(confirmTradeCompletion(confirmed, 'player-a', firstDate), confirmed);
  });
});

