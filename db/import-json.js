const fs = require('fs');
const path = require('path');
const { createConfiguredPool } = require('./pool');

const PROJECT_ROOT = path.join(__dirname, '..');

function readJsonArray(filename) {
  const filepath = path.join(PROJECT_ROOT, filename);
  if (!fs.existsSync(filepath)) return [];
  const value = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${filename} must contain a JSON array`);
  return value;
}

function requiredText(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function timestamp(value) {
  return value || new Date(0).toISOString();
}

function normalizeCard(card, board) {
  return {
    cardId: requiredText(card.id, 'card.id'), board, name: requiredText(card.name, 'card.name'),
    setCode: card.set || null, collectorNumber: card.collectorNumber || null,
    rarity: card.rarity || null, typeLine: card.type || null,
    imageUrl: card.image || null, imageLargeUrl: card.imageLarge || null,
    prices: card.prices || null, quantity: Math.max(1, Number(card.quantity) || 1),
  };
}

function normalizeCollection(collection, type) {
  const cards = type === 'deck'
    ? [...(collection.main || []).map((card) => normalizeCard(card, 'main')), ...(collection.sideboard || []).map((card) => normalizeCard(card, 'sideboard'))]
    : (collection.cards || []).map((card) => normalizeCard(card, 'main'));
  return {
    id: requiredText(collection.id, `${type}.id`), userId: requiredText(collection.userId, `${type}.userId`),
    type, name: requiredText(collection.name, `${type}.name`),
    description: String(collection.description || '').trim(), format: collection.format || null,
    createdAt: timestamp(collection.createdAt), updatedAt: timestamp(collection.updatedAt || collection.createdAt), cards,
  };
}

function buildImportModel(data) {
  return {
    users: (data.users || []).map((user) => ({
      id: requiredText(user.id, 'user.id'), username: requiredText(user.username, 'user.username'),
      passwordHash: requiredText(user.passwordHash || user.password, 'user.passwordHash'),
      createdAt: timestamp(user.createdAt), updatedAt: timestamp(user.updatedAt || user.createdAt),
    })),
    collections: [
      ...(data.decks || []).map((item) => normalizeCollection(item, 'deck')),
      ...(data.binders || []).map((item) => normalizeCollection(item, 'binder')),
      ...(data.wishlists || []).map((item) => normalizeCollection(item, 'wishlist')),
    ],
  };
}

async function importModel(pool, model) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const user of model.users) {
      await client.query(`INSERT INTO users (id, username, password_hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password_hash = EXCLUDED.password_hash, updated_at = EXCLUDED.updated_at`,
      [user.id, user.username, user.passwordHash, user.createdAt, user.updatedAt]);
    }
    for (const collection of model.collections) {
      await client.query(`INSERT INTO collections
        (id, user_id, type, name, description, format, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, format = EXCLUDED.format, updated_at = EXCLUDED.updated_at`,
      [collection.id, collection.userId, collection.type, collection.name, collection.description, collection.format, collection.createdAt, collection.updatedAt]);
      await client.query('DELETE FROM collection_cards WHERE collection_id = $1', [collection.id]);
      for (const card of collection.cards) {
        await client.query(`INSERT INTO collection_cards
          (collection_id, card_id, board, name, set_code, collector_number, rarity, type_line, image_url, image_large_url, prices, quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [collection.id, card.cardId, card.board, card.name, card.setCode, card.collectorNumber, card.rarity, card.typeLine, card.imageUrl, card.imageLargeUrl, card.prices, card.quantity]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const model = buildImportModel({
    users: readJsonArray('users.json'), decks: readJsonArray('decks.json'),
    binders: readJsonArray('binders.json'), wishlists: readJsonArray('wishlists.json'),
  });
  const pool = createConfiguredPool();
  try {
    await importModel(pool, model);
    console.log(`Imported ${model.users.length} users and ${model.collections.length} collections`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { buildImportModel, importModel, normalizeCollection, readJsonArray };
