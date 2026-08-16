const { normalizeTradeProfile } = require('./model');

function mapTradeProfile(row) {
  if (!row) return null;
  return normalizeTradeProfile({
    userId: row.user_id,
    countryCode: row.country_code,
    region: row.region,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    searchRadiusKm: row.search_radius_km,
    tradeEnabled: row.trade_enabled,
    visibility: row.location_visibility,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  });
}

class PostgresTradeProfileRepository {
  constructor(pool) { this.pool = pool; }

  async findByUserId(userId) {
    const result = await this.pool.query(
      `SELECT u.id AS user_id, tp.country_code, tp.region, tp.city, tp.latitude,
              tp.longitude, tp.search_radius_km, tp.trade_enabled,
              tp.location_visibility, tp.updated_at
       FROM users u LEFT JOIN trade_profiles tp ON tp.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return mapTradeProfile(result.rows[0]);
  }

  async upsert(userId, profile) {
    const normalized = normalizeTradeProfile({ userId, ...profile });
    const result = await this.pool.query(
      `INSERT INTO trade_profiles (
         user_id, country_code, region, city, latitude, longitude,
         search_radius_km, trade_enabled, location_visibility
       )
       SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9
       WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)
       ON CONFLICT (user_id) DO UPDATE SET
         country_code = EXCLUDED.country_code,
         region = EXCLUDED.region,
         city = EXCLUDED.city,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         search_radius_km = EXCLUDED.search_radius_km,
         trade_enabled = EXCLUDED.trade_enabled,
         location_visibility = EXCLUDED.location_visibility,
         updated_at = now()
       RETURNING user_id, country_code, region, city, latitude, longitude,
                 search_radius_km, trade_enabled, location_visibility, updated_at`,
      [normalized.userId, normalized.countryCode, normalized.region, normalized.city,
        normalized.latitude, normalized.longitude, normalized.searchRadiusKm,
        normalized.tradeEnabled, normalized.visibility],
    );
    return mapTradeProfile(result.rows[0]);
  }
}

module.exports = { PostgresTradeProfileRepository, mapTradeProfile };
