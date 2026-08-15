const express = require('express');
const { createWishlistRepository } = require('../src/repositories/wishlist');
const { normalizeCard } = require('../src/repositories/wishlist/model');

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

function createWishlistRouter(repository = createWishlistRepository()) {
  const router = express.Router();
  async function owned(req, res) {
    const wishlist = await repository.findById(req.params.id);
    if (!wishlist) { res.status(404).json({ error: 'Wishlist no encontrada' }); return null; }
    if (wishlist.userId !== req.user.id) { res.status(403).json({ error: 'No es tu wishlist' }); return null; }
    return wishlist;
  }

  router.get('/', asyncRoute(async (req, res) => res.json({ wishlists: await repository.listByUser(req.user.id) })));
  router.post('/', asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const wishlist = await repository.create({ userId: req.user.id, name, description: String(req.body?.description || '').trim().slice(0, 280) });
    return res.status(201).json({ wishlist });
  }));
  router.get('/:id', asyncRoute(async (req, res) => { const wishlist = await owned(req, res); if (wishlist) res.json({ wishlist }); }));
  router.patch('/:id', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    const changes = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Nombre requerido' });
      changes.name = name;
    }
    if (req.body?.description !== undefined) changes.description = String(req.body.description).trim().slice(0, 280);
    if (Array.isArray(req.body?.cards)) changes.cards = req.body.cards.map((card) => normalizeCard(card));
    return res.json({ wishlist: await repository.update(req.params.id, changes) });
  }));
  router.delete('/:id', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    await repository.delete(req.params.id);
    return res.json({ ok: true });
  }));
  router.post('/:id/cards', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    const { card, quantity = 1 } = req.body || {};
    if (!card?.id || !card?.name) return res.status(400).json({ error: 'Carta invalida' });
    return res.json({ wishlist: await repository.addCard(req.params.id, normalizeCard(card, quantity), quantity) });
  }));
  router.patch('/:id/cards/:cardId', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    const quantity = Number(req.body?.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'Cantidad invalida' });
    const wishlist = await repository.setCardQuantity(req.params.id, req.params.cardId, quantity);
    if (wishlist === undefined) return res.status(404).json({ error: 'Carta no encontrada' });
    return res.json({ wishlist });
  }));
  router.delete('/:id/cards/:cardId', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    const wishlist = await repository.removeCard(req.params.id, req.params.cardId);
    if (wishlist === undefined) return res.status(404).json({ error: 'Carta no encontrada' });
    return res.json({ wishlist });
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Wishlist persistence error:', error.message);
    return res.status(500).json({ error: 'No se pudo procesar la wishlist' });
  });
  return router;
}

module.exports = createWishlistRouter();
module.exports.createWishlistRouter = createWishlistRouter;
