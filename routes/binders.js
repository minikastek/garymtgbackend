const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'binders.json');

function loadBinders() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).map((b) => {
    if (!Array.isArray(b.cards)) b.cards = [];
    if (b.description == null) b.description = '';
    return b;
  });
}

function saveBinders(binders) {
  fs.writeFileSync(DB_PATH, JSON.stringify(binders, null, 2));
}

function countCards(list) {
  return (list || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
}

function publicBinder(b) {
  return {
    id: b.id,
    name: b.name,
    description: b.description || '',
    userId: b.userId,
    cards: b.cards || [],
    cardCount: countCards(b.cards),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function ownBinder(req, res) {
  const binder = loadBinders().find((b) => b.id === req.params.id);
  if (!binder) {
    res.status(404).json({ error: 'Binder no encontrado' });
    return null;
  }
  if (binder.userId !== req.user.id) {
    res.status(403).json({ error: 'No es tu binder' });
    return null;
  }
  return binder;
}

function cardPayload(card, qty) {
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    collectorNumber: card.collectorNumber,
    rarity: card.rarity,
    type: card.type,
    image: card.image,
    imageLarge: card.imageLarge,
    prices: card.prices,
    quantity: qty,
  };
}

router.get('/', (req, res) => {
  const binders = loadBinders()
    .filter((b) => b.userId === req.user.id)
    .map(publicBinder);
  res.json({ binders });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const description = String(req.body.description || '').trim().slice(0, 280);

  const binders = loadBinders();
  const now = new Date().toISOString();
  const binder = {
    id: Date.now().toString(),
    userId: req.user.id,
    name,
    description,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
  binders.push(binder);
  saveBinders(binders);
  res.status(201).json({ binder: publicBinder(binder) });
});

router.get('/:id', (req, res) => {
  const binder = ownBinder(req, res);
  if (!binder) return;
  res.json({ binder: publicBinder(binder) });
});

/** Guardar/editar: { name?, description?, cards? } — sin límites de cantidad */
router.patch('/:id', (req, res) => {
  const binder = ownBinder(req, res);
  if (!binder) return;

  const binders = loadBinders();
  const current = binders.find((b) => b.id === binder.id);

  if (req.body.name != null) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    current.name = name;
  }

  if (req.body.description != null) {
    current.description = String(req.body.description).trim().slice(0, 280);
  }

  if (Array.isArray(req.body.cards)) {
    current.cards = req.body.cards.map((c) => ({
      ...c,
      quantity: Math.max(1, Number(c.quantity) || 1),
    }));
  }

  current.updatedAt = new Date().toISOString();
  saveBinders(binders);
  res.json({ binder: publicBinder(current) });
});

router.delete('/:id', (req, res) => {
  const binder = ownBinder(req, res);
  if (!binder) return;
  saveBinders(loadBinders().filter((b) => b.id !== binder.id));
  res.json({ ok: true });
});

router.post('/:id/cards', (req, res) => {
  const binder = ownBinder(req, res);
  if (!binder) return;

  const { card, quantity = 1 } = req.body || {};
  if (!card?.id || !card?.name) {
    return res.status(400).json({ error: 'Carta inválida' });
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const binders = loadBinders();
  const current = binders.find((b) => b.id === binder.id);
  const existing = current.cards.find((c) => c.id === card.id);

  if (existing) existing.quantity += qty;
  else current.cards.push(cardPayload(card, qty));

  current.updatedAt = new Date().toISOString();
  saveBinders(binders);
  res.json({ binder: publicBinder(current) });
});

module.exports = router;
