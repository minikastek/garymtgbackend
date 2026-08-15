const { PostgresBinderRepository } = require('../binder/postgres');
const { PostgresWishlistRepository } = require('../wishlist/postgres');

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar ?? row.avatar_url ?? null,
  };
}

class PostgresTradeRepository {
  constructor({
    pool,
    binderRepository = new PostgresBinderRepository({ pool }),
    wishlistRepository = new PostgresWishlistRepository({ pool }),
  }) {
    if (!pool) throw new Error('PostgresTradeRepository requires a pool');
    this.pool = pool;
    this.binderRepository = binderRepository;
    this.wishlistRepository = wishlistRepository;
  }

  async searchUsers(query, excludedUserId, limit = 20) {
    const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 20);
    const result = await this.pool.query(
      `SELECT * FROM users
       WHERE id <> $1 AND LOWER(username) LIKE $2
       ORDER BY LOWER(username), id
       LIMIT $3`,
      [excludedUserId, `%${String(query || '').trim().toLowerCase()}%`, boundedLimit],
    );
    return result.rows.map(mapUser);
  }

  async findUserById(id) {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
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

module.exports = { PostgresTradeRepository };
