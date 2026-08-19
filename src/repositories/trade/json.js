const fs = require('fs');
const path = require('path');
const { normalizeTrade } = require('./model');

class JsonTradeRepository {
  constructor(options = {}) {
    this.filepath = options.filepath || path.join(__dirname, '..', '..', '..', 'trades.json');
  }

  load() {
    if (!fs.existsSync(this.filepath)) return [];
    const value = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (!Array.isArray(value)) throw new Error('trades.json must contain a JSON array');
    return value.map(normalizeTrade);
  }

  save(values) {
    fs.mkdirSync(path.dirname(this.filepath), { recursive: true });
    const temporary = `${this.filepath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(values, null, 2));
    fs.renameSync(temporary, this.filepath);
  }

  findById(id) {
    return this.load().find((trade) => trade.id === String(id)) || null;
  }

  listByParticipant(userId) {
    const participantId = String(userId);
    return this.load()
      .filter((trade) => trade.proposerUserId === participantId || trade.recipientUserId === participantId)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  }

  create(value) {
    const values = this.load();
    const trade = normalizeTrade(value);
    if (values.some((item) => item.id === trade.id)) throw new Error(`Trade already exists: ${trade.id}`);
    values.push(trade);
    this.save(values);
    return trade;
  }

  replace(value) {
    const values = this.load();
    const trade = normalizeTrade(value);
    const index = values.findIndex((item) => item.id === trade.id);
    if (index === -1) return null;
    values[index] = trade;
    this.save(values);
    return trade;
  }
}

module.exports = { JsonTradeRepository };
