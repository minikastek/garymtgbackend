const express = require('express');
const { createDeckRepository } = require('../src/repositories/deck');
const { normalizeCard } = require('../src/repositories/deck/model');
const { ensureBoards, evaluateLegality, isBasicLand, maxCopiesFor } = require('../src/utils/deck-legality');

function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }
function parseBoard(value) { return value === 'sideboard' ? 'sideboard' : 'main'; }
function cardKey(name) { return String(name || '').toLowerCase().split(' // ')[0]; }
function totalCopies(deck, name) {
  return ['main', 'sideboard'].flatMap((board) => deck[board])
    .filter((card) => cardKey(card.name) === cardKey(name))
    .reduce((total, card) => total + (Number(card.quantity) || 0), 0);
}
function publicDeck(deck) {
  ensureBoards(deck);
  return { id: deck.id, name: deck.name, userId: deck.userId, main: deck.main, sideboard: deck.sideboard,
    legality: evaluateLegality(deck), createdAt: deck.createdAt, updatedAt: deck.updatedAt };
}

function createDeckRouter(repository = createDeckRepository()) {
  const router = express.Router();
  async function owned(req, res) {
    const deck = await repository.findById(req.params.id);
    if (!deck) { res.status(404).json({ error: 'Deck no encontrado' }); return null; }
    if (deck.userId !== req.user.id) { res.status(403).json({ error: 'No es tu deck' }); return null; }
    return ensureBoards(deck);
  }
  async function persist(deck) {
    deck.updatedAt = new Date().toISOString();
    return repository.save(deck);
  }

  router.get('/', asyncRoute(async (req, res) => res.json({ decks: (await repository.listByUser(req.user.id)).map(publicDeck) })));
  router.post('/', asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    return res.status(201).json({ deck: publicDeck(await repository.create({ userId: req.user.id, name })) });
  }));
  router.get('/:id', asyncRoute(async (req, res) => { const deck = await owned(req, res); if (deck) res.json({ deck: publicDeck(deck) }); }));
  router.patch('/:id', asyncRoute(async (req, res) => {
    const deck = await owned(req, res);
    if (!deck) return;
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Nombre requerido' });
      deck.name = name;
    }
    if (Array.isArray(req.body?.main)) deck.main = req.body.main.map(normalizeCard);
    if (Array.isArray(req.body?.sideboard)) deck.sideboard = req.body.sideboard.map(normalizeCard);
    const legality = evaluateLegality(deck);
    if (legality.copyViolations.length) return res.status(400).json({ error: 'Copias invalidas', legality });
    return res.json({ deck: publicDeck(await persist(deck)) });
  }));
  router.delete('/:id', asyncRoute(async (req, res) => {
    if (!await owned(req, res)) return;
    await repository.delete(req.params.id);
    return res.json({ ok: true });
  }));
  router.post('/:id/cards', asyncRoute(async (req, res) => {
    const deck = await owned(req, res);
    if (!deck) return;
    const { card, quantity = 1 } = req.body || {};
    if (!card?.id || !card?.name) return res.status(400).json({ error: 'Carta invalida' });
    const board = parseBoard(req.body?.board);
    const qty = Math.max(1, Math.min(999, Number(quantity) || 1));
    const existing = deck[board].find((item) => item.id === String(card.id));
    const nextTotal = totalCopies(deck, card.name) + qty;
    if (!isBasicLand(card) && nextTotal > maxCopiesFor(card)) return res.status(400).json({ error: `Maximo ${maxCopiesFor(card)} copias de "${card.name}"` });
    if (existing) existing.quantity += qty;
    else deck[board].push(normalizeCard({ ...card, quantity: qty }));
    return res.json({ deck: publicDeck(await persist(deck)) });
  }));
  router.patch('/:id/cards/:cardId', asyncRoute(async (req, res) => {
    const deck = await owned(req, res);
    if (!deck) return;
    const board = parseBoard(req.body?.board || req.query.board);
    const quantity = Number(req.body?.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Cantidad invalida' });
    const entry = deck[board].find((card) => card.id === req.params.cardId);
    if (!entry) return res.status(404).json({ error: 'Carta no esta en esa seccion' });
    if (quantity === 0) deck[board] = deck[board].filter((card) => card.id !== entry.id);
    else {
      const other = totalCopies(deck, entry.name) - entry.quantity;
      if (!isBasicLand(entry) && other + quantity > maxCopiesFor(entry)) return res.status(400).json({ error: `Maximo ${maxCopiesFor(entry)} copias entre main y sideboard` });
      entry.quantity = quantity;
    }
    return res.json({ deck: publicDeck(await persist(deck)) });
  }));
  router.delete('/:id/cards/:cardId', asyncRoute(async (req, res) => {
    const deck = await owned(req, res);
    if (!deck) return;
    const board = parseBoard(req.query.board || req.body?.board);
    deck[board] = deck[board].filter((card) => card.id !== req.params.cardId);
    return res.json({ deck: publicDeck(await persist(deck)) });
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Deck persistence error:', error.message);
    return res.status(500).json({ error: 'No se pudo procesar el deck' });
  });
  return router;
}

module.exports = createDeckRouter();
module.exports.createDeckRouter = createDeckRouter;
