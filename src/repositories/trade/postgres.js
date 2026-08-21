const { normalizeTrade } = require('./model');

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function mapTrade(row, items = []) {
  return normalizeTrade({
    id: row.id,
    proposerUserId: row.proposer_user_id,
    recipientUserId: row.recipient_user_id,
    parentTradeId: row.parent_trade_id,
    status: row.status,
    offeredItems: items.filter((item) => item.side === 'offered').map(mapItem),
    requestedItems: items.filter((item) => item.side === 'requested').map(mapItem),
    coordination: row.coordination,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    acceptedAt: iso(row.accepted_at),
    declinedAt: iso(row.declined_at),
    cancelledAt: iso(row.cancelled_at),
    proposerCompletedAt: iso(row.proposer_completed_at),
    recipientCompletedAt: iso(row.recipient_completed_at),
    completedAt: iso(row.completed_at),
  });
}

function mapItem(row) {
  return {
    binderId: row.binder_id,
    cardId: row.card_id,
    name: row.name || null,
    set: row.set_code || null,
    collectorNumber: row.collector_number || null,
    quantity: row.quantity,
    unitValue: row.unit_value == null ? null : Number(row.unit_value),
    priceSource: row.price_source || null,
    priceObservedAt: iso(row.price_observed_at) || null,
  };
}

const TRADE_COLUMNS = `id, proposer_user_id, recipient_user_id, parent_trade_id, status,
  coordination, created_at, updated_at, accepted_at, declined_at, cancelled_at,
  proposer_completed_at, recipient_completed_at, completed_at`;

class PostgresTradeRepository {
  constructor(pool) { this.pool = pool; }

  async itemsFor(ids, client = this.pool) {
    if (!ids.length) return new Map();
    const result = await client.query(
      `SELECT proposal_id, binder_id, card_id, name, set_code, collector_number,
              quantity, unit_value, price_source, price_observed_at, side, position
       FROM trade_proposal_items
       WHERE proposal_id = ANY($1::text[])
       ORDER BY proposal_id, side, position, id`, [ids]);
    const grouped = new Map(ids.map((id) => [id, []]));
    for (const row of result.rows) grouped.get(row.proposal_id)?.push(row);
    return grouped;
  }

  async findById(id, client = this.pool) {
    const result = await client.query(
      `SELECT ${TRADE_COLUMNS} FROM trade_proposals WHERE id = $1`, [id]);
    if (!result.rows[0]) return null;
    const items = await this.itemsFor([result.rows[0].id], client);
    return mapTrade(result.rows[0], items.get(result.rows[0].id));
  }

  async listByParticipant(userId) {
    const result = await this.pool.query(
      `SELECT ${TRADE_COLUMNS} FROM trade_proposals
       WHERE proposer_user_id = $1 OR recipient_user_id = $1
       ORDER BY created_at DESC`, [userId]);
    const items = await this.itemsFor(result.rows.map((row) => row.id));
    return result.rows.map((row) => mapTrade(row, items.get(row.id)));
  }

  async create(value) {
    const trade = normalizeTrade(value);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.insertTrade(client, trade);
      await this.replaceItems(client, trade);
      await client.query('COMMIT');
      return trade;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async replace(value) {
    const trade = normalizeTrade(value);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE trade_proposals SET status = $1, coordination = $2, accepted_at = $3,
          declined_at = $4, cancelled_at = $5, proposer_completed_at = $6,
          recipient_completed_at = $7, completed_at = $8, updated_at = $9
         WHERE id = $10`,
        [trade.status, trade.coordination, trade.acceptedAt, trade.declinedAt,
          trade.cancelledAt, trade.proposerCompletedAt, trade.recipientCompletedAt,
          trade.completedAt, trade.updatedAt, trade.id]);
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      await this.replaceItems(client, trade);
      await client.query('COMMIT');
      return trade;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  insertTrade(client, trade) {
    return client.query(
      `INSERT INTO trade_proposals
        (id, proposer_user_id, recipient_user_id, parent_trade_id, status,
         coordination, created_at, updated_at, accepted_at, declined_at, cancelled_at,
         proposer_completed_at, recipient_completed_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [trade.id, trade.proposerUserId, trade.recipientUserId, trade.parentTradeId,
        trade.status, trade.coordination, trade.createdAt, trade.updatedAt, trade.acceptedAt,
        trade.declinedAt, trade.cancelledAt, trade.proposerCompletedAt,
        trade.recipientCompletedAt, trade.completedAt]);
  }

  async replaceItems(client, trade) {
    await client.query('DELETE FROM trade_proposal_items WHERE proposal_id = $1', [trade.id]);
    for (const [side, items, ownerId] of [
      ['offered', trade.offeredItems, trade.proposerUserId],
      ['requested', trade.requestedItems, trade.recipientUserId],
    ]) {
      for (const [position, item] of items.entries()) {
        await client.query(
          `INSERT INTO trade_proposal_items
            (proposal_id, owner_user_id, binder_id, card_id, name, set_code,
             collector_number, quantity, unit_value, price_source, price_observed_at,
             side, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [trade.id, ownerId, item.binderId, item.cardId, item.name || null,
            item.set || null, item.collectorNumber || null, item.quantity,
            item.unitValue ?? null, item.priceSource || null, item.priceObservedAt || null,
            side, position]);
      }
    }
  }
}

module.exports = { PostgresTradeRepository };
