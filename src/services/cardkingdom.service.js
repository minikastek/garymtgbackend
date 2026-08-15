const cache = require('../cache/memory-cache');
const { monitoredFetch } = require('../utils/request-monitor');

const URL = 'https://api.cardkingdom.com/api/v2/pricelist';

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(name, set) {
  return `${String(name || '').trim().toLowerCase()}|${String(set || '').trim().toLowerCase()}`;
}

function indexProducts(raw) {
  const list = Array.isArray(raw) ? raw : raw?.data || raw?.products || [];
  const byScryfallId = new Map();
  const byNameSet = new Map();

  for (const p of list) {
    const name = p.name || p.Name;
    const edition = p.edition || p.Edition || p.set || '';
    const scryfallId = p.scryfall_id || p.scryfallId || p.ScryfallID || null;
    const isFoil = p.is_foil === true || p.is_foil === 'true' || p.IsFoil === true || p.IsFoil === 'true';
    if (isFoil) continue; // ponytail: priorizar non-foil NM

    const entry = {
      name,
      set: edition,
      condition: 'NM',
      price: toNum(p.price_retail ?? p.PriceRetail ?? p.price),
      buy_price: toNum(p.price_buy ?? p.PriceBuy ?? p.buy_price),
      scryfallId,
    };

    if (scryfallId && !byScryfallId.has(scryfallId)) {
      byScryfallId.set(scryfallId, entry);
    }
    const key = normalizeKey(name, edition);
    if (!byNameSet.has(key)) byNameSet.set(key, entry);
  }

  return { byScryfallId, byNameSet, count: list.length };
}

async function loadPricelist() {
  const cached = cache.get('cardkingdom:pricelist');
  if (cached) return cached;

  const res = await monitoredFetch('Card Kingdom', URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'GaryMTG/1.0' },
  });
  if (!res.ok) {
    const err = new Error(`Card Kingdom ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const indexed = indexProducts(raw);
  return cache.set('cardkingdom:pricelist', indexed);
}

async function findPrice({ scryfallId, name, set }) {
  try {
    const index = await loadPricelist();
    if (scryfallId && index.byScryfallId.has(scryfallId)) {
      return index.byScryfallId.get(scryfallId);
    }
    const key = normalizeKey(name, set);
    return index.byNameSet.get(key) || null;
  } catch {
    // sin precio CK si falla la API
    return null;
  }
}

module.exports = { loadPricelist, findPrice, normalizeKey };
