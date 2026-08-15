const express = require('express');
const { createBinderRepository } = require('../src/repositories/binder');
const { normalizeCard } = require('../src/repositories/binder/model');

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }

function createBinderRouter(repository = createBinderRepository()) {
  const router = express.Router();
  async function owned(req, res) {
    const binder = await repository.findById(req.params.id);
    if (!binder) { res.status(404).json({ error: 'Binder no encontrado' }); return null; }
    if (binder.userId !== req.user.id) { res.status(403).json({ error: 'No es tu binder' }); return null; }
    return binder;
  }

  router.get('/', asyncRoute(async (req, res) => res.json({ binders: await repository.listByUser(req.user.id) })));
  router.post('/', asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const binder = await repository.create({ userId: req.user.id, name, description: String(req.body?.description || '').trim().slice(0, 280) });
    return res.status(201).json({ binder });
  }));
  router.get('/:id', asyncRoute(async (req, res) => { const binder = await owned(req, res); if (binder) res.json({ binder }); }));
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
    return res.json({ binder: await repository.update(req.params.id, changes) });
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
    return res.json({ binder: await repository.addCard(req.params.id, normalizeCard(card, quantity), quantity) });
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Binder persistence error:', error.message);
    return res.status(500).json({ error: 'No se pudo procesar el binder' });
  });
  return router;
}

module.exports = createBinderRouter();
module.exports.createBinderRouter = createBinderRouter;
