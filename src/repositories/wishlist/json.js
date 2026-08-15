const fs = require('fs');
const path = require('path');
const { normalizeCard, normalizeWishlist } = require('./model');

class JsonWishlistRepository {
  constructor(options = {}) {
    this.filepath = options.filepath || path.join(__dirname, '..', '..', '..', 'wishlists.json');
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => Date.now().toString());
  }

  load() {
    if (!fs.existsSync(this.filepath)) return [];
    const value = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('wishlists.json must contain a JSON array');
    return value.map(normalizeWishlist);
  }

  save(values) {
    fs.mkdirSync(path.dirname(this.filepath), { recursive: true });
    const temporary = `${this.filepath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(values, null, 2));
    fs.renameSync(temporary, this.filepath);
  }

  listByUser(userId) { return this.load().filter((item) => item.userId === userId); }
  findById(id) { return this.load().find((item) => item.id === id) || null; }

  create({ userId, name, description }) {
    const values = this.load();
    const now = this.now().toISOString();
    const wishlist = normalizeWishlist({ id: this.idFactory(), userId, name, description, cards: [], createdAt: now, updatedAt: now });
    values.push(wishlist);
    this.save(values);
    return wishlist;
  }

  update(id, changes) {
    const values = this.load();
    const wishlist = values.find((item) => item.id === id);
    if (!wishlist) return null;
    if (changes.name !== undefined) wishlist.name = changes.name;
    if (changes.description !== undefined) wishlist.description = changes.description;
    if (changes.cards !== undefined) wishlist.cards = changes.cards.map((card) => normalizeCard(card));
    wishlist.updatedAt = this.now().toISOString();
    this.save(values);
    return normalizeWishlist(wishlist);
  }

  delete(id) {
    const values = this.load();
    const remaining = values.filter((item) => item.id !== id);
    if (remaining.length === values.length) return false;
    this.save(remaining);
    return true;
  }

  addCard(id, card, quantity) {
    const values = this.load();
    const wishlist = values.find((item) => item.id === id);
    if (!wishlist) return null;
    const existing = wishlist.cards.find((item) => item.id === String(card.id));
    if (existing) existing.quantity += Math.max(1, Number(quantity) || 1);
    else wishlist.cards.push(normalizeCard(card, quantity));
    wishlist.updatedAt = this.now().toISOString();
    this.save(values);
    return normalizeWishlist(wishlist);
  }

  setCardQuantity(id, cardId, quantity) {
    const values = this.load();
    const wishlist = values.find((item) => item.id === id);
    if (!wishlist) return null;
    const card = wishlist.cards.find((item) => item.id === cardId);
    if (!card) return undefined;
    if (quantity === 0) wishlist.cards = wishlist.cards.filter((item) => item.id !== cardId);
    else card.quantity = quantity;
    wishlist.updatedAt = this.now().toISOString();
    this.save(values);
    return normalizeWishlist(wishlist);
  }

  removeCard(id, cardId) { return this.setCardQuantity(id, cardId, 0); }
}

module.exports = { JsonWishlistRepository };
