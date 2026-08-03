const MIN_MAIN = 60;
const MAX_SIDEBOARD = 15;
const MAX_COPIES = 4;
const BASIC_LAND_NAMES = new Set([
  'plains',
  'island',
  'swamp',
  'mountain',
  'forest',
  'snow-covered plains',
  'snow-covered island',
  'snow-covered swamp',
  'snow-covered mountain',
  'snow-covered forest',
  'wastes',
]);

function isBasicLand(card) {
  if (/Basic Land/i.test(card?.type || card?.type_line || '')) return true;
  const name = String(card?.name || '').trim().toLowerCase();
  // doble cara: tomar el frente
  const front = name.split(' // ')[0];
  return BASIC_LAND_NAMES.has(front);
}

function maxCopiesFor(card) {
  return isBasicLand(card) ? 999 : MAX_COPIES;
}

function countCards(list) {
  return (list || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
}

/** Migra decks viejos { cards } → { main, sideboard } */
function ensureBoards(deck) {
  if (!deck.main && !deck.sideboard && Array.isArray(deck.cards)) {
    deck.main = deck.cards;
    deck.sideboard = [];
    delete deck.cards;
  }
  if (!Array.isArray(deck.main)) deck.main = [];
  if (!Array.isArray(deck.sideboard)) deck.sideboard = [];
  return deck;
}

function totalByOracleName(deck) {
  const map = new Map();
  for (const board of ['main', 'sideboard']) {
    for (const c of deck[board] || []) {
      const key = String(c.name || '').toLowerCase().split(' // ')[0];
      const prev = map.get(key) || { name: c.name, quantity: 0, sample: c };
      prev.quantity += Number(c.quantity) || 0;
      map.set(key, prev);
    }
  }
  return map;
}

function evaluateLegality(deck) {
  ensureBoards(deck);
  const mainCount = countCards(deck.main);
  const sideboardCount = countCards(deck.sideboard);
  const mainNeeded = Math.max(0, MIN_MAIN - mainCount);
  const sideboardOver = Math.max(0, sideboardCount - MAX_SIDEBOARD);

  const copyViolations = [];
  for (const { name, quantity, sample } of totalByOracleName(deck).values()) {
    const max = maxCopiesFor(sample);
    if (quantity > max) {
      copyViolations.push({ name, quantity, max });
    }
  }

  const messages = [];
  if (mainNeeded > 0) {
    messages.push(`Faltan ${mainNeeded} carta${mainNeeded === 1 ? '' : 's'} en el main (mín. ${MIN_MAIN})`);
  }
  if (sideboardOver > 0) {
    messages.push(`Sideboard: sobran ${sideboardOver} (máx. ${MAX_SIDEBOARD})`);
  }
  for (const v of copyViolations) {
    messages.push(`${v.name}: ${v.quantity}/${v.max} copias`);
  }

  return {
    legal: mainNeeded === 0 && sideboardOver === 0 && copyViolations.length === 0,
    mainCount,
    sideboardCount,
    mainNeeded,
    sideboardOver,
    copyViolations,
    messages,
    minMain: MIN_MAIN,
    maxSideboard: MAX_SIDEBOARD,
  };
}

module.exports = {
  MIN_MAIN,
  MAX_SIDEBOARD,
  MAX_COPIES,
  isBasicLand,
  maxCopiesFor,
  countCards,
  ensureBoards,
  evaluateLegality,
};
