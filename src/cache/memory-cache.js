const TTL_MS = 24 * 60 * 60 * 1000; // 24h

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs = TTL_MS) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function clear(key) {
  if (key) store.delete(key);
  else store.clear();
}

module.exports = { get, set, clear, TTL_MS };
