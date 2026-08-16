const fs = require('fs');
const path = require('path');
const { mergeDefined, normalizeTradeProfile } = require('./model');

class JsonTradeProfileRepository {
  constructor(options = {}) {
    this.filepath = options.filepath || path.join(__dirname, '..', '..', '..', 'users.json');
    this.now = options.now || (() => new Date());
  }

  loadUsers() {
    if (!fs.existsSync(this.filepath)) return [];
    const users = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
    if (!Array.isArray(users)) throw new Error('users.json must contain a JSON array');
    return users;
  }

  saveUsers(users) {
    fs.mkdirSync(path.dirname(this.filepath), { recursive: true });
    const temporary = `${this.filepath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(users, null, 2));
    fs.renameSync(temporary, this.filepath);
  }

  findByUserId(userId) {
    const user = this.loadUsers().find((candidate) => String(candidate.id) === String(userId));
    if (!user) return null;
    return normalizeTradeProfile({ userId: user.id, ...(user.tradeProfile || {}) });
  }

  upsert(userId, changes) {
    const users = this.loadUsers();
    const user = users.find((candidate) => String(candidate.id) === String(userId));
    if (!user) return null;

    const current = normalizeTradeProfile({ userId: user.id, ...(user.tradeProfile || {}) });
    const updatedAt = this.now().toISOString();
    const profile = normalizeTradeProfile({
      ...mergeDefined(current, changes),
      userId: user.id,
      updatedAt,
    });
    user.tradeProfile = profile;
    this.saveUsers(users);
    return profile;
  }
}

module.exports = { JsonTradeProfileRepository };
