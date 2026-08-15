const fs = require('fs');
const path = require('path');
const { createConfiguredPool } = require('./pool');

const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;

function migrationFiles(directory = MIGRATIONS_DIRECTORY) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function runMigrations(pool, directory = MIGRATIONS_DIRECTORY) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [17329741]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const appliedResult = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.version));
    const completed = [];
    for (const filename of migrationFiles(directory)) {
      if (applied.has(filename)) continue;
      await client.query(fs.readFileSync(path.join(directory, filename), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [filename]);
      completed.push(filename);
    }
    await client.query('COMMIT');
    return completed;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const pool = createConfiguredPool();
  try {
    const completed = await runMigrations(pool);
    console.log(completed.length ? `Applied: ${completed.join(', ')}` : 'Database is up to date');
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { MIGRATION_FILE_PATTERN, migrationFiles, runMigrations };
