const express = require('express');
const { createTradeRepository } = require('../src/repositories/trade');
const { compareCollections, countCards, publicUser } = require('../src/services/trade-match');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createTradeRouter(repository = createTradeRepository()) {
  const router = express.Router();

  router.get('/users', asyncRoute(async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) return res.json({ users: [] });

    const users = await repository.searchUsers(query, req.user.id, 20);
    return res.json({ users: users.map(publicUser) });
  }));

  router.get('/users/:userId/binders', asyncRoute(async (req, res) => {
    const user = await repository.findUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const binders = (await repository.listBindersByUser(user.id)).map((binder) => ({
      id: binder.id,
      name: binder.name,
      description: binder.description || '',
      cardCount: countCards(binder.cards),
    }));

    return res.json({ user: publicUser(user), binders });
  }));

  router.post('/compare', asyncRoute(async (req, res) => {
    const { targetUserId, binderId, wishlistId } = req.body || {};
    if (!targetUserId || !binderId || !wishlistId) {
      return res.status(400).json({ error: 'Faltan targetUserId, binderId o wishlistId' });
    }

    const targetUser = await repository.findUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const binder = await repository.findBinderById(binderId);
    if (!binder || binder.userId !== targetUserId) {
      return res.status(404).json({ error: 'Binder no encontrado' });
    }

    const wishlist = await repository.findWishlistById(wishlistId);
    if (!wishlist || wishlist.userId !== req.user.id) {
      return res.status(404).json({ error: 'Wishlist no encontrada' });
    }

    const matches = compareCollections(binder.cards, wishlist.cards);
    return res.json({
      targetUser: publicUser(targetUser),
      binder: { id: binder.id, name: binder.name, description: binder.description || '' },
      wishlist: { id: wishlist.id, name: wishlist.name, description: wishlist.description || '' },
      matchCount: matches.length,
      matches,
    });
  }));

  router.use((error, _req, res, _next) => {
    console.error('trade route error', error.message);
    res.status(500).json({ error: 'No se pudo procesar el intercambio' });
  });

  return router;
}

module.exports = { createTradeRouter };
