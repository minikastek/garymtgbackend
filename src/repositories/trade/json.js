const fs = require('fs');
const path = require('path');
const { JsonBinderRepository } = require('../binder/json');
const { JsonWishlistRepository } = require('../wishlist/json');

class JsonTradeRepository {
  constructor({
    usersPath = path.join(__dirname, '..', '..', '..', 'users.json'),
    bindersPath = path.join(__dirname, '..', '..', '..', 'binders.json'),
    wishlistsPath = path.join(__dirname, '..', '..', '..', 'wishlists.json'),
    binderRepository = new JsonBinderRepository({ filepath: bindersPath }),
    wishlistRepository = new JsonWishlistRepository({ filepath: wishlistsPath }),
  } = {}) {
    this.usersPath = usersPath;
    this.binderRepository = binderRepository;
    this.wishlistRepository = wishlistRepository;
  }

  loadUsers() {
    if (!fs.existsSync(this.usersPath)) return [];
    return JSON.parse(fs.readFileSync(this.usersPath, 'utf8'));
  }

  async searchUsers(query, excludedUserId, limit = 20) {
    const normalized = String(query || '').trim().toLowerCase();
    return this.loadUsers()
      .filter((user) => user.id !== excludedUserId)
      .filter((user) => String(user.username || '').toLowerCase().includes(normalized))
      .slice(0, Math.min(Math.max(Number(limit) || 20, 1), 20));
  }

  async findUserById(id) {
    return this.loadUsers().find((user) => user.id === id) || null;
  }

  async listBindersByUser(userId) {
    return this.binderRepository.listByUser(userId);
  }

  async findBinderById(id) {
    return this.binderRepository.findById(id);
  }

  async findWishlistById(id) {
    return this.wishlistRepository.findById(id);
  }
}

module.exports = { JsonTradeRepository };
