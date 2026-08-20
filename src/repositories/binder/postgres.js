const { randomUUID } = require('crypto');
const { normalizeBinder } = require('./model');

function mapCard(row) {
  return {
    id: row.card_id, name: row.name, set: row.set_code, collectorNumber: row.collector_number,
    rarity: row.rarity, type: row.type_line, image: row.image_url,
    imageLarge: row.image_large_url, prices: row.prices, quantity: row.quantity,
  };
}

function mapBinder(row, cards = []) {
  return normalizeBinder({
    id: row.id, userId: row.user_id, name: row.name, description: row.description,
    tradeEnabled: row.trade_enabled === true, cards,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  });
}

class PostgresBinderRepository {
  constructor(pool, options = {}) { this.pool = pool; this.idFactory = options.idFactory || randomUUID; }

  async cardsFor(ids, client = this.pool) {
    if (!ids.length) return new Map();
    const result = await client.query(
      `SELECT collection_id, card_id, name, set_code, collector_number, rarity,
              type_line, image_url, image_large_url, prices, quantity
       FROM collection_cards WHERE collection_id = ANY($1::text[]) ORDER BY id`, [ids]);
    const grouped = new Map(ids.map((id) => [id, []]));
    for (const row of result.rows) grouped.get(row.collection_id)?.push(mapCard(row));
    return grouped;
  }

  async listByUser(userId) {
    const result = await this.pool.query(
      "SELECT id, user_id, name, description, trade_enabled, created_at, updated_at FROM collections WHERE user_id = $1 AND type = 'binder' ORDER BY created_at DESC", [userId]);
    const cards = await this.cardsFor(result.rows.map((row) => row.id));
    return result.rows.map((row) => mapBinder(row, cards.get(row.id)));
  }

  async findById(id, client = this.pool) {
    const result = await client.query(
      "SELECT id, user_id, name, description, trade_enabled, created_at, updated_at FROM collections WHERE id = $1 AND type = 'binder'", [id]);
    if (!result.rows[0]) return null;
    const cards = await this.cardsFor([id], client);
    return mapBinder(result.rows[0], cards.get(id));
  }

  async create({ userId, name, description, tradeEnabled = false }) {
    const result = await this.pool.query(
      "INSERT INTO collections (id, user_id, type, name, description, trade_enabled) VALUES ($1, $2, 'binder', $3, $4, $5) RETURNING id, user_id, name, description, trade_enabled, created_at, updated_at",
      [this.idFactory(), userId, name, description, tradeEnabled]);
    return mapBinder(result.rows[0]);
  }

  async update(id, changes) {
    const assignments = [];
    const values = [];
    if (changes.name !== undefined) { values.push(changes.name); assignments.push(`name = $${values.length}`); }
    if (changes.description !== undefined) { values.push(changes.description); assignments.push(`description = $${values.length}`); }
    if (changes.tradeEnabled !== undefined) { values.push(changes.tradeEnabled); assignments.push(`trade_enabled = $${values.length}`); }
    if (assignments.length) {
      values.push(id);
      await this.pool.query(`UPDATE collections SET ${assignments.join(', ')}, updated_at = now() WHERE id = $${values.length} AND type = 'binder'`, values);
    }
    if (changes.cards !== undefined) await this.replaceCards(id, changes.cards);
    return this.findById(id);
  }

  async replaceCards(id, cards) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM collection_cards WHERE collection_id = $1', [id]);
      for (const card of cards) await this.insertCard(client, id, card, card.quantity);
      await client.query('UPDATE collections SET updated_at = now(), version = version + 1 WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  insertCard(client, id, card, quantity) {
    return client.query(
      `INSERT INTO collection_cards (collection_id, card_id, board, name, set_code, collector_number, rarity, type_line, image_url, image_large_url, prices, quantity)
       VALUES ($1, $2, 'main', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, card.id, card.name, card.set || null, card.collectorNumber || null, card.rarity || null,
        card.type || null, card.image || null, card.imageLarge || null, card.prices || null, Math.max(1, Number(quantity) || 1)]);
  }

  async delete(id) {
    const result = await this.pool.query("DELETE FROM collections WHERE id = $1 AND type = 'binder'", [id]);
    return result.rowCount > 0;
  }

  async addCard(id, card, quantity) {
    await this.pool.query(
      `INSERT INTO collection_cards (collection_id, card_id, board, name, set_code, collector_number, rarity, type_line, image_url, image_large_url, prices, quantity)
       VALUES ($1, $2, 'main', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (collection_id, board, card_id) DO UPDATE SET quantity = collection_cards.quantity + EXCLUDED.quantity, updated_at = now()`,
      [id, card.id, card.name, card.set || null, card.collectorNumber || null, card.rarity || null,
        card.type || null, card.image || null, card.imageLarge || null, card.prices || null, Math.max(1, Number(quantity) || 1)]);
    await this.pool.query('UPDATE collections SET updated_at = now(), version = version + 1 WHERE id = $1', [id]);
    return this.findById(id);
  }
}

module.exports = { PostgresBinderRepository };
