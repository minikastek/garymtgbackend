const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  ensureBoards,
  evaluateLegality,
  isBasicLand,
  maxCopiesFor,
} = require('../src/utils/deck-legality');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'decks.json');

function loadDecks() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).map((d) => ensureBoards(d));
}

function saveDecks(decks) {
  fs.writeFileSync(DB_PATH, JSON.stringify(decks, null, 2));
}

function publicDeck(d) {
  ensureBoards(d);
  return {
    id: d.id,
    name: d.name,
    userId: d.userId,
    main: d.main,
    sideboard: d.sideboard,
    legality: evaluateLegality(d),
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
  return ensureBoards(deck);
}

function parseBoard(value) {
  return value === 'sideboard' ? 'sideboard' : 'main';
}

/** Cantidad total de una carta (por nombre) en main + sideboard */
function totalCopies(deck, cardName) {
  const key = String(cardName || '').toLowerCase().split(' // ')[0];
  let total = 0;
  for (const board of ['main', 'sideboard']) {
    for (const c of deck[board]) {
      if (String(c.name || '').toLowerCase().split(' // ')[0] === key) {
        total += Number(c.quantity) || 0;
      }
    }
  }
  return total;
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
    main: [],
    sideboard: [],
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

/** Editar / guardar decklist asociada al usuario. body: { name?, main?, sideboard? } */
router.patch('/:id', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  ensureBoards(current);

  if (req.body.name != null) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    current.name = name;
  }

  if (Array.isArray(req.body.main)) current.main = req.body.main;
  if (Array.isArray(req.body.sideboard)) current.sideboard = req.body.sideboard;

  // bloquear solo exceso de copias (no-básicas); main incompleto sí se puede guardar
  const legality = evaluateLegality(current);
  if (legality.copyViolations.length) {
    return res.status(400).json({
      error: `Copias inválidas: ${legality.copyViolations.map((v) => `${v.name} (${v.quantity}/${v.max})`).join(', ')}`,
      legality,
    });
  }

  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

router.delete('/:id', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;
  saveDecks(loadDecks().filter((d) => d.id !== deck.id));
  res.json({ ok: true });
});

/** body: { card, quantity, board: 'main'|'sideboard' } */
router.post('/:id/cards', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const { card, quantity = 1 } = req.body || {};
  const board = parseBoard(req.body?.board);
  if (!card?.id || !card?.name) {
    return res.status(400).json({ error: 'Carta inválida' });
  }

  const qty = Math.max(1, Math.min(999, Number(quantity) || 1));
  const max = maxCopiesFor(card);
  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  ensureBoards(current);

  const existing = current[board].find((c) => c.id === card.id);
  const otherBoardsQty = totalCopies(current, card.name) - (existing?.quantity || 0);
  const nextTotal = otherBoardsQty + (existing?.quantity || 0) + qty;

  if (!isBasicLand(card) && nextTotal > max) {
    return res.status(400).json({
      error: `Máximo ${max} copias de "${card.name}" entre main y sideboard (ahora ${otherBoardsQty + (existing?.quantity || 0)})`,
    });
  }

  if (existing) {
    existing.quantity += qty;
  } else {
    current[board].push(cardPayload(card, qty));
  }

  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

router.patch('/:id/cards/:cardId', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const board = parseBoard(req.body?.board || req.query.board);
  const quantity = Number(req.body.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Cantidad inválida' });
  }

  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  ensureBoards(current);
  const entry = current[board].find((c) => c.id === req.params.cardId);
  if (!entry) return res.status(404).json({ error: 'Carta no está en esa sección' });

  const max = maxCopiesFor(entry);
  if (quantity === 0) {
    current[board] = current[board].filter((c) => c.id !== entry.id);
  } else {
    const otherQty = totalCopies(current, entry.name) - entry.quantity;
    if (!isBasicLand(entry) && otherQty + quantity > max) {
      return res.status(400).json({
        error: `Máximo ${max} copias entre main y sideboard`,
      });
    }
    entry.quantity = quantity;
  }

  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

router.delete('/:id/cards/:cardId', (req, res) => {
  const deck = ownDeck(req, res);
  if (!deck) return;

  const board = parseBoard(req.query.board || req.body?.board);
  const decks = loadDecks();
  const current = decks.find((d) => d.id === deck.id);
  ensureBoards(current);
  current[board] = current[board].filter((c) => c.id !== req.params.cardId);
  current.updatedAt = new Date().toISOString();
  saveDecks(decks);
  res.json({ deck: publicDeck(current) });
});

module.exports = router;
