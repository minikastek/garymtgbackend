const TRADE_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
});

const COORDINATION_METHODS = new Set(['in_person', 'shipping', 'other']);

class TradeLifecycleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TradeLifecycleError';
    this.code = code;
  }
}

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requireParticipant(trade, actorId) {
  if (actorId !== trade.proposerUserId && actorId !== trade.recipientUserId) {
    throw new TradeLifecycleError('FORBIDDEN', 'Only trade participants can perform this action');
  }
}

function requireStatus(trade, expected) {
  if (trade.status !== expected) {
    throw new TradeLifecycleError('INVALID_STATUS', `Trade must be ${expected}`);
  }
}

function normalizeTrade(value) {
  return {
    id: String(value.id),
    proposerUserId: String(value.proposerUserId),
    recipientUserId: String(value.recipientUserId),
    parentTradeId: value.parentTradeId ? String(value.parentTradeId) : null,
    status: value.status || TRADE_STATUSES.PENDING,
    offeredItems: Array.isArray(value.offeredItems) ? value.offeredItems.map((item) => ({ ...item })) : [],
    requestedItems: Array.isArray(value.requestedItems) ? value.requestedItems.map((item) => ({ ...item })) : [],
    coordination: value.coordination ? { ...value.coordination } : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    acceptedAt: value.acceptedAt || null,
    declinedAt: value.declinedAt || null,
    cancelledAt: value.cancelledAt || null,
    proposerCompletedAt: value.proposerCompletedAt || null,
    recipientCompletedAt: value.recipientCompletedAt || null,
    completedAt: value.completedAt || null,
  };
}

function createTrade(input, options = {}) {
  const proposerUserId = String(input.proposerUserId || '').trim();
  const recipientUserId = String(input.recipientUserId || '').trim();
  if (!proposerUserId || !recipientUserId) {
    throw new TradeLifecycleError('INVALID_PARTICIPANT', 'Both trade participants are required');
  }
  if (proposerUserId === recipientUserId) {
    throw new TradeLifecycleError('INVALID_PARTICIPANT', 'A player cannot trade with themselves');
  }
  if (!Array.isArray(input.offeredItems) || input.offeredItems.length === 0
      || !Array.isArray(input.requestedItems) || input.requestedItems.length === 0) {
    throw new TradeLifecycleError('INVALID_ITEMS', 'A trade requires offered and requested cards');
  }

  const now = timestamp((options.now || (() => new Date()))());
  return normalizeTrade({
    id: (options.idFactory || (() => Date.now().toString()))(),
    proposerUserId,
    recipientUserId,
    parentTradeId: input.parentTradeId,
    status: TRADE_STATUSES.PENDING,
    offeredItems: input.offeredItems,
    requestedItems: input.requestedItems,
    createdAt: now,
    updatedAt: now,
  });
}

function acceptTrade(value, actorId, now = new Date()) {
  const trade = normalizeTrade(value);
  requireStatus(trade, TRADE_STATUSES.PENDING);
  if (actorId !== trade.recipientUserId) {
    throw new TradeLifecycleError('FORBIDDEN', 'Only the recipient can accept a trade');
  }
  const at = timestamp(now);
  return { ...trade, status: TRADE_STATUSES.ACCEPTED, acceptedAt: at, updatedAt: at };
}

function declineTrade(value, actorId, now = new Date()) {
  const trade = normalizeTrade(value);
  requireStatus(trade, TRADE_STATUSES.PENDING);
  if (actorId !== trade.recipientUserId) {
    throw new TradeLifecycleError('FORBIDDEN', 'Only the recipient can decline a trade');
  }
  const at = timestamp(now);
  return { ...trade, status: TRADE_STATUSES.DECLINED, declinedAt: at, updatedAt: at };
}

function cancelTrade(value, actorId, now = new Date()) {
  const trade = normalizeTrade(value);
  requireStatus(trade, TRADE_STATUSES.PENDING);
  if (actorId !== trade.proposerUserId) {
    throw new TradeLifecycleError('FORBIDDEN', 'Only the proposer can cancel a trade');
  }
  const at = timestamp(now);
  return { ...trade, status: TRADE_STATUSES.CANCELLED, cancelledAt: at, updatedAt: at };
}

function updateCoordination(value, actorId, input, now = new Date()) {
  const trade = normalizeTrade(value);
  requireParticipant(trade, actorId);
  requireStatus(trade, TRADE_STATUSES.ACCEPTED);
  if (trade.proposerCompletedAt || trade.recipientCompletedAt) {
    throw new TradeLifecycleError('COORDINATION_LOCKED', 'Coordination cannot change after completion confirmation');
  }

  const method = String(input.method || '').trim();
  const notes = String(input.notes || '').trim();
  if (!COORDINATION_METHODS.has(method)) {
    throw new TradeLifecycleError('INVALID_COORDINATION', 'Unsupported coordination method');
  }
  if (notes.length > 500) {
    throw new TradeLifecycleError('INVALID_COORDINATION', 'Coordination notes must be 500 characters or fewer');
  }

  const at = timestamp(now);
  return { ...trade, coordination: { method, notes }, updatedAt: at };
}

function confirmTradeCompletion(value, actorId, now = new Date()) {
  const trade = normalizeTrade(value);
  requireParticipant(trade, actorId);
  requireStatus(trade, TRADE_STATUSES.ACCEPTED);

  const field = actorId === trade.proposerUserId ? 'proposerCompletedAt' : 'recipientCompletedAt';
  if (trade[field]) return trade;

  const at = timestamp(now);
  const confirmed = { ...trade, [field]: at, updatedAt: at };
  if (confirmed.proposerCompletedAt && confirmed.recipientCompletedAt) {
    return { ...confirmed, status: TRADE_STATUSES.COMPLETED, completedAt: at };
  }
  return confirmed;
}

module.exports = {
  TRADE_STATUSES,
  TradeLifecycleError,
  normalizeTrade,
  createTrade,
  acceptTrade,
  declineTrade,
  cancelTrade,
  updateCoordination,
  confirmTradeCompletion,
};

