const express = require('express');
const fs = require('fs');
const path = require('path');
const { createBinderRepository } = require('../src/repositories/binder');
const { createWishlistRepository } = require('../src/repositories/wishlist');
const { createTradeRepository } = require('../src/repositories/trade');
const { createTrade } = require('../src/repositories/trade/model');
const cardkingdom = require('../src/services/cardkingdom.service');

const USERS_PATH = path.join(__dirname, '..', 'users.json');

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

function loadJson(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function publicUser(u) {
  return { id: u.id, username: u.username, avatar: u.avatar };
}

/** Misma carta sin importar edición / cara DFC */
function cardKey(name) {
  return String(name || '')
    .toLowerCase()
    .split(' // ')[0]
    .trim();
}

function countCards(list) {
  return (list || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
}

function tradableBinders(binders, userId) {
  return binders
    .filter((binder) => binder.userId === userId && binder.tradeEnabled === true)
    .map((binder) => ({
      id: binder.id,
      name: binder.name,
      description: binder.description || '',
      cardCount: countCards(binder.cards),
    }));
}

function parseProposalItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const parsed = items.map((item) => ({
    binderId: String(item?.binderId || '').trim(),
    cardId: String(item?.cardId || '').trim(),
    quantity: Number(item?.quantity),
  }));
  return parsed.every((item) => item.binderId && item.cardId
    && Number.isInteger(item.quantity) && item.quantity > 0) ? parsed : null;
}

async function currentPrice(card) {
  const ck = await cardkingdom.findPrice({
    scryfallId: card.id,
    name: card.name,
    set: card.set,
  });
  if (Number.isFinite(ck?.price) && ck.price >= 0) {
    return { unitValue: ck.price, priceSource: 'cardkingdom' };
  }
  const scryfall = Number(card.prices?.scryfallUsd);
  return Number.isFinite(scryfall) && scryfall >= 0
    ? { unitValue: scryfall, priceSource: 'scryfall' }
    : { unitValue: null, priceSource: null };
}

function createTradeRouter(options = {}) {
  const router = express.Router();
  const binderRepository = options.binderRepository || createBinderRepository();
  const wishlistRepository = options.wishlistRepository || createWishlistRepository();
  const tradeRepository = options.tradeRepository || createTradeRepository();
  const priceResolver = options.priceResolver || currentPrice;
  const now = options.now || (() => new Date());
  const jsonLoader = options.jsonLoader || loadJson;

  async function snapshotItems(items, ownerId, requiresPublicBinder, observedAt) {
    const snapshots = [];
    const binders = new Map();
    const selectedQuantities = new Map();
    for (const item of items) {
      if (!binders.has(item.binderId)) {
        binders.set(item.binderId, await binderRepository.findById(item.binderId));
      }
      const binder = binders.get(item.binderId);
      if (!binder || binder.userId !== ownerId
          || (requiresPublicBinder && binder.tradeEnabled !== true)) {
        return { status: 404, error: 'Cartas de intercambio no disponibles' };
      }
      const card = (binder.cards || []).find((candidate) => String(candidate.id) === item.cardId);
      if (!card) return { status: 404, error: 'Cartas de intercambio no disponibles' };
      const selectionKey = `${item.binderId}:${item.cardId}`;
      const selectedQuantity = (selectedQuantities.get(selectionKey) || 0) + item.quantity;
      if (selectedQuantity > Number(card.quantity || 0)) {
        return { status: 409, error: 'Cantidad de cartas no disponible' };
      }
      selectedQuantities.set(selectionKey, selectedQuantity);
      const price = await priceResolver(card);
      const unitValue = Number(price?.unitValue);
      snapshots.push({
        binderId: item.binderId,
        cardId: item.cardId,
        name: card.name,
        set: card.set || null,
        collectorNumber: card.collectorNumber || null,
        quantity: item.quantity,
        unitValue: Number.isFinite(unitValue) && unitValue >= 0 ? unitValue : null,
        priceSource: price?.priceSource || null,
        priceObservedAt: observedAt,
      });
    }
    return { snapshots };
  }

/** GET /api/trade/users?q=ali */
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 1) return res.json({ users: [] });

  const users = jsonLoader(USERS_PATH)
    .filter((u) => u.id !== req.user.id)
    .filter((u) => u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(publicUser);

  res.json({ users });
});

/** GET /api/trade/users/:userId/binders */
router.get('/users/:userId/binders', asyncRoute(async (req, res) => {
  const user = jsonLoader(USERS_PATH).find((u) => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const binders = tradableBinders(await binderRepository.listByUser(user.id), user.id);

  res.json({ user: publicUser(user), binders });
}));

/**
 * POST /api/trade/compare
 * body: { targetUserId, binderId, wishlistId }
 * Coincide por nombre de carta (ignora set/edición).
 */
router.post('/compare', asyncRoute(async (req, res) => {
  const { targetUserId, binderId, wishlistId } = req.body || {};
  if (!targetUserId || !binderId || !wishlistId) {
    return res.status(400).json({ error: 'Faltan targetUserId, binderId o wishlistId' });
  }

  const targetUser = jsonLoader(USERS_PATH).find((u) => u.id === targetUserId);
  if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

  const binder = await binderRepository.findById(binderId);
  if (!binder || binder.userId !== targetUserId || binder.tradeEnabled !== true) {
    return res.status(404).json({ error: 'Binder no encontrado' });
  }

  const wishlist = await wishlistRepository.findById(wishlistId);
  if (!wishlist || wishlist.userId !== req.user.id) {
    return res.status(404).json({ error: 'Wishlist no encontrada' });
  }

  // wishlist: key → { name, quantity, printings }
  const wanted = new Map();
  for (const c of wishlist.cards || []) {
    const key = cardKey(c.name);
    if (!key) continue;
    const prev = wanted.get(key) || { name: c.name.split(' // ')[0], quantity: 0, printings: [] };
    prev.quantity += Number(c.quantity) || 0;
    prev.printings.push({
      id: c.id,
      set: c.set,
      collectorNumber: c.collectorNumber,
      image: c.image,
      quantity: c.quantity,
    });
    wanted.set(key, prev);
  }

  // binder matches
  const matchMap = new Map();
  for (const c of binder.cards || []) {
    const key = cardKey(c.name);
    if (!wanted.has(key)) continue;
    const prev = matchMap.get(key) || {
      name: wanted.get(key).name,
      wishlistQuantity: wanted.get(key).quantity,
      binderQuantity: 0,
      binderPrintings: [],
      wishlistPrintings: wanted.get(key).printings,
    };
    prev.binderQuantity += Number(c.quantity) || 0;
    prev.binderPrintings.push({
      id: c.id,
      set: c.set,
      collectorNumber: c.collectorNumber,
      image: c.image,
      rarity: c.rarity,
      quantity: c.quantity,
    });
    matchMap.set(key, prev);
  }

  const matches = [...matchMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    targetUser: publicUser(targetUser),
    binder: { id: binder.id, name: binder.name, description: binder.description || '' },
    wishlist: { id: wishlist.id, name: wishlist.name, description: wishlist.description || '' },
    matchCount: matches.length,
    matches,
  });
}));

/** POST /api/trade/proposals */
router.post('/proposals', asyncRoute(async (req, res) => {
  const recipientUserId = String(req.body?.recipientUserId || '').trim();
  const offeredItems = parseProposalItems(req.body?.offeredItems);
  const requestedItems = parseProposalItems(req.body?.requestedItems);
  if (!recipientUserId || !offeredItems || !requestedItems || recipientUserId === req.user.id) {
    return res.status(400).json({ error: 'Propuesta de intercambio invalida' });
  }

  const recipient = jsonLoader(USERS_PATH).find((user) => user.id === recipientUserId);
  if (!recipient) return res.status(404).json({ error: 'Usuario no encontrado' });

  const observedAt = now().toISOString();
  const offered = await snapshotItems(offeredItems, req.user.id, false, observedAt);
  if (offered.error) return res.status(offered.status).json({ error: offered.error });
  const requested = await snapshotItems(requestedItems, recipientUserId, true, observedAt);
  if (requested.error) return res.status(requested.status).json({ error: requested.error });

  const trade = createTrade({
    proposerUserId: req.user.id,
    recipientUserId,
    offeredItems: offered.snapshots,
    requestedItems: requested.snapshots,
  }, { now });
  return res.status(201).json({ trade: await tradeRepository.create(trade) });
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Trade proposal error:', error.message);
  return res.status(500).json({ error: 'No se pudo crear la propuesta' });
});

  return router;
}

module.exports = createTradeRouter();
module.exports.createTradeRouter = createTradeRouter;
module.exports.tradableBinders = tradableBinders;
