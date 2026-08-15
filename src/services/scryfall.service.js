const cache = require('../cache/memory-cache');
const { monitoredFetch } = require('../utils/request-monitor');

const BASE = 'https://api.scryfall.com';
const MIN_GAP_MS = 100; // Scryfall: ~10 req/s
const MAX_SEARCH_RESULTS = 20;

let lastRequestAt = 0;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithBackoff(url, attempt = 0) {
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
  if (wait) await sleep(wait);
  lastRequestAt = Date.now();

  const res = await monitoredFetch('Scryfall', url, {
    headers: { Accept: 'application/json', 'User-Agent': 'GaryMTG/1.0' },
  });

  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('Retry-After') || 1);
    await sleep((retryAfter + attempt) * 1000);
    return fetchWithBackoff(url, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Scryfall ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function pickImages(card) {
  if (card.image_uris) {
    return {
      small: card.image_uris.small,
      normal: card.image_uris.normal,
      large: card.image_uris.large,
    };
  }
  // double-faced
  const face = card.card_faces?.[0]?.image_uris;
  if (face) {
    return { small: face.small, normal: face.normal, large: face.large };
  }
  return { small: null, normal: null, large: null };
}

function cleanCard(card) {
  const images = pickImages(card);
  return {
    id: card.id,
    name: card.name,
    set: (card.set || '').toUpperCase(),
    collector_number: String(card.collector_number || ''),
    rarity: card.rarity,
    type_line: card.type_line,
    oracle_text: card.oracle_text || card.card_faces?.[0]?.oracle_text || null,
    image_uris: images,
    prices: { usd: card.prices?.usd ? Number(card.prices.usd) : null },
  };
}

async function searchCards(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  const cacheKey = `scryfall:search:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/cards/search?unique=prints&q=${encodeURIComponent(q)}`;
  try {
    const data = await fetchWithBackoff(url);
    const cards = (data.data || []).map(cleanCard);
    const qLower = q.toLowerCase();
    cards.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aRank = aName === qLower ? 0 : aName.startsWith(qLower) ? 1 : aName.includes(qLower) ? 2 : 3;
      const bRank = bName === qLower ? 0 : bName.startsWith(qLower) ? 1 : bName.includes(qLower) ? 2 : 3;
      return aRank - bRank || aName.localeCompare(bName);
    });
    return cache.set(cacheKey, cards.slice(0, MAX_SEARCH_RESULTS));
  } catch (err) {
    if (err.status === 404) return cache.set(cacheKey, []);
    throw err;
  }
}

module.exports = { searchCards, cleanCard };
