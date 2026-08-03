const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'decks.json');
const MAX_COPIES = 4; // Standard (salvo lands básicos: se permite más)

function loadDecks() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDecks(decks) {
  fs.writeFileSync(DB_PATH, JSON.stringify(decks, null, 2));
}

function isBasicLand(type) {
  return /Basic Land/i.test(type || '');
}

function publicDeck(d) {
  return {
    id: d.id,
    name: d.name,
    userId: d.userId,
    cards: d.cards || [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function ownDeck(req, res) {
  const deck = loadDecks().find((d) => d.id === req.params.id);
  if (!deck) {
    res.status(404).json({ error: 'Deck no encontrado' });
    return null;
  }
  if (deck.userId !== req.user.id) {
    res.status(403).json({ error: 'No es tu deck' });
    return null;
  }
  return deck;
}

router.get('/', (req, res) => {
  const decks = loadDecks()
    .filter((d) => d.userId === req.user.id)
    .map(publicDeck);
  res.json({ decks });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });

  const decks = loadDecks();
  const now = new Date().toISOString();
  const deck = {
    id: Date.now().toString(),
    userId: req.user.id,
    name,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
  decks.push(deck);
  saveDecks(decks);
  res.status(201).json({ deck: publicDeck(deck) });
});

router.get('/:id', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;
  res.json({ deck: publicDeck(deck) });
});

router.delete('/:id', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;
  saveDecks(loadDecks().filter((d) => d.id !== deck.id));
  res.json({ ok: true });
});

/** Añadir o sumar cartas. body: { card, quantity } */
router.post('/:id/cards', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const { card, quantity = 1 } = req.body || {};
  if (!card?.id || !card?.name) {
    return res.status(400).json({ error: 'Carta inválida' });
  }

  const qty = Math.max(1, Math.min(99, Number(quantity) || 1));
  const decks = loadDecks();
  const idx = decks.findIndex((d) => d.id === deck.id);
  const current = decks[idx];
  const existing = current.cards.find((c) => c.id === card.id);
  const max = isBasicLand(card.type) ? 99 : MAX_COPIES;

  if (existing) {
    const next = existing.quantity + qty;
    if (next > max) {
      return res.status(400).json({ error: `Máximo ${max} copias de esta carta` });
    }
    existing.quantity = next;
  } else {
    if (qty > max) {
      return res.status(400).json({ error: `Máximo ${max} copias de esta carta` });
    }
    current.cards.push({
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
    });
  }

  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

router.patch('/:id/cards/:cardId', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const quantity = Number(req.body.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Cantidad inválida' });
  }

  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  const entry = current.cards.find((c) => c.id === req.params.cardId);
  if (!entry) return res.status(404).json({ error: 'Carta no está en el deck' });

  const max = isBasicLand(entry.type) ? 99 : MAX_COPIES;
  if (quantity === 0) {
    current.cards = current.cards.filter((c) => c.id !== entry.id);
  } else if (quantity > max) {
    return res.status(400).json({ error: `Máximo ${max} copias` });
  } else {
    entry.quantity = quantity;
  }

  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

router.delete('/:id/cards/:cardId', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  current.cards = current.cards.filter((c) => c.id !== req.params.cardId);
  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

module.exports = router;
