const { randomUUID } = require('crypto');
const { normalizeDeck } = require('./model');

function mapCard(row) {
  return {
    id: row.card_id, name: row.name, set: row.set_code, collectorNumber: row.collector_number,
    rarity: row.rarity, type: row.type_line, image: row.image_url,
    imageLarge: row.image_large_url, prices: row.prices, quantity: row.quantity,
  };
}

function mapDeck(row, cards = []) {
  return normalizeDeck({
    id: row.id, userId: row.user_id, name: row.name,
    main: cards.filter((card) => card.board === 'main').map((card) => card.value),
    sideboard: cards.filter((card) => card.board === 'sideboard').map((card) => card.value),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  });
}

class PostgresDeckRepository {
  constructor(pool, options = {}) { this.pool = pool; this.idFactory = options.idFactory || randomUUID; }

  async cardsFor(ids, client = this.pool) {
    if (!ids.length) return new Map();
    const result = await client.query(
      `SELECT collection_id, board, card_id, name, set_code, collector_number, rarity,
              type_line, image_url, image_large_url, prices, quantity
       FROM collection_cards WHERE collection_id = ANY($1::text[]) ORDER BY id`, [ids]);
    const grouped = new Map(ids.map((id) => [id, []]));
    for (const row of result.rows) grouped.get(row.collection_id)?.push({ board: row.board, value: mapCard(row) });
    return grouped;
  }

  async listByUser(userId) {
    const result = await this.pool.query(
      "SELECT id, user_id, name, created_at, updated_at FROM collections WHERE user_id = $1 AND type = 'deck' ORDER BY created_at DESC", [userId]);
    const cards = await this.cardsFor(result.rows.map((row) => row.id));
    return result.rows.map((row) => mapDeck(row, cards.get(row.id)));
  }

  async findById(id, client = this.pool) {
    const result = await client.query(
      "SELECT id, user_id, name, created_at, updated_at FROM collections WHERE id = $1 AND type = 'deck'", [id]);
    if (!result.rows[0]) return null;
    const cards = await this.cardsFor([id], client);
    return mapDeck(result.rows[0], cards.get(id));
  }

  async create({ userId, name }) {
    const result = await this.pool.query(
      "INSERT INTO collections (id, user_id, type, name) VALUES ($1, $2, 'deck', $3) RETURNING id, user_id, name, created_at, updated_at",
      [this.idFactory(), userId, name]);
    return mapDeck(result.rows[0]);
  }

  async save(deck) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        "UPDATE collections SET name = $1, updated_at = $2, version = version + 1 WHERE id = $3 AND type = 'deck' RETURNING id",
        [deck.name, deck.updatedAt, deck.id]);
      if (!updated.rowCount) { await client.query('ROLLBACK'); return null; }
      await client.query('DELETE FROM collection_cards WHERE collection_id = $1', [deck.id]);
      for (const card of deck.main) await this.insertCard(client, deck.id, 'main', card);
      for (const card of deck.sideboard) await this.insertCard(client, deck.id, 'sideboard', card);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    return this.findById(deck.id);
  }

  insertCard(client, id, board, card) {
    return client.query(
      `INSERT INTO collection_cards (collection_id, card_id, board, name, set_code, collector_number, rarity, type_line, image_url, image_large_url, prices, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, card.id, board, card.name, card.set || null, card.collectorNumber || null, card.rarity || null,
        card.type || null, card.image || null, card.imageLarge || null, card.prices || null, card.quantity]);
  }

  async delete(id) {
    const result = await this.pool.query("DELETE FROM collections WHERE id = $1 AND type = 'deck'", [id]);
    return result.rowCount > 0;
  }
}

module.exports = { PostgresDeckRepository };
