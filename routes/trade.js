const express = require('express');
const fs = require('fs');
const path = require('path');
const { createBinderRepository } = require('../src/repositories/binder');
const { createWishlistRepository } = require('../src/repositories/wishlist');

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

function createTradeRouter(options = {}) {
  const router = express.Router();
  const binderRepository = options.binderRepository || createBinderRepository();
  const wishlistRepository = options.wishlistRepository || createWishlistRepository();
  const jsonLoader = options.jsonLoader || loadJson;

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

  return router;
}

module.exports = createTradeRouter();
module.exports.createTradeRouter = createTradeRouter;
module.exports.tradableBinders = tradableBinders;
