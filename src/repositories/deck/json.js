const fs = require('fs');
const path = require('path');
const { normalizeDeck } = require('./model');

class JsonDeckRepository {
  constructor(options = {}) {
    this.filepath = options.filepath || path.join(__dirname, '..', '..', '..', 'decks.json');
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || (() => Date.now().toString());
  }

  load() {
    if (!fs.existsSync(this.filepath)) return [];
    const value = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('decks.json must contain a JSON array');
    return value.map(normalizeDeck);
  }

  saveAll(values) {
    fs.mkdirSync(path.dirname(this.filepath), { recursive: true });
    const temporary = `${this.filepath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(values, null, 2));
    fs.renameSync(temporary, this.filepath);
  }

  listByUser(userId) { return this.load().filter((deck) => deck.userId === userId); }
  findById(id) { return this.load().find((deck) => deck.id === id) || null; }

  create({ userId, name }) {
    const values = this.load();
    const now = this.now().toISOString();
    const deck = normalizeDeck({ id: this.idFactory(), userId, name, main: [], sideboard: [], createdAt: now, updatedAt: now });
    values.push(deck);
    this.saveAll(values);
    return deck;
  }

  save(deck) {
    const values = this.load();
    const index = values.findIndex((item) => item.id === deck.id);
    if (index < 0) return null;
    values[index] = normalizeDeck(deck);
    this.saveAll(values);
    return values[index];
  }

  delete(id) {
    const values = this.load();
    const remaining = values.filter((deck) => deck.id !== id);
    if (remaining.length === values.length) return false;
    this.saveAll(remaining);
    return true;
  }
}

module.exports = { JsonDeckRepository };
