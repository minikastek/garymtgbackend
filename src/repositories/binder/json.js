const fs = require('fs');
const path = require('path');
const { normalizeBinder, normalizeCard } = require('./model');

class JsonBinderRepository {
  constructor(options = {}) {
    this.filepath = options.filepath || path.join(__dirname, '..', '..', '..', 'binders.json');
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => Date.now().toString());
  }

  load() {
    if (!fs.existsSync(this.filepath)) return [];
    const value = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('binders.json must contain a JSON array');
    return value.map(normalizeBinder);
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
    const binder = normalizeBinder({ id: this.idFactory(), userId, name, description, cards: [], createdAt: now, updatedAt: now });
    values.push(binder);
    this.save(values);
    return binder;
  }

  update(id, changes) {
    const values = this.load();
    const binder = values.find((item) => item.id === id);
    if (!binder) return null;
    if (changes.name !== undefined) binder.name = changes.name;
    if (changes.description !== undefined) binder.description = changes.description;
    if (changes.cards !== undefined) binder.cards = changes.cards.map((card) => normalizeCard(card));
    binder.updatedAt = this.now().toISOString();
    this.save(values);
    return normalizeBinder(binder);
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
    const binder = values.find((item) => item.id === id);
    if (!binder) return null;
    const existing = binder.cards.find((item) => item.id === String(card.id));
    if (existing) existing.quantity += Math.max(1, Number(quantity) || 1);
    else binder.cards.push(normalizeCard(card, quantity));
    binder.updatedAt = this.now().toISOString();
    this.save(values);
    return normalizeBinder(binder);
  }
}

module.exports = { JsonBinderRepository };
