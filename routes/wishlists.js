const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'wishlists.json');

function loadWishlists() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')).map((w) => {
    if (!Array.isArray(w.cards)) w.cards = [];
    if (w.description == null) w.description = '';
    return w;
  });
}

function saveWishlists(wishlists) {
  fs.writeFileSync(DB_PATH, JSON.stringify(wishlists, null, 2));
}

function countCards(list) {
  return (list || []).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
}

function publicWishlist(w) {
  return {
    id: w.id,
    name: w.name,
    description: w.description || '',
    userId: w.userId,
    cards: w.cards || [],
    cardCount: countCards(w.cards),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

function ownWishlist(req, res) {
  const wishlist = loadWishlists().find((w) => w.id === req.params.id);
  if (!wishlist) {
    res.status(404).json({ error: 'Wishlist no encontrada' });
    return null;
  }
  if (wishlist.userId !== req.user.id) {
    res.status(403).json({ error: 'No es tu wishlist' });
    return null;
  }
  return wishlist;
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
  const wishlists = loadWishlists()
    .filter((w) => w.userId === req.user.id)
    .map(publicWishlist);
  res.json({ wishlists });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const description = String(req.body.description || '').trim().slice(0, 280);

  const wishlists = loadWishlists();
  const now = new Date().toISOString();
  const wishlist = {
    id: Date.now().toString(),
    userId: req.user.id,
    name,
    description,
    cards: [],
    createdAt: now,
    updatedAt: now,
  };
  wishlists.push(wishlist);
  saveWishlists(wishlists);
  res.status(201).json({ wishlist: publicWishlist(wishlist) });
});

router.get('/:id', (req, res) => {
  const wishlist = ownWishlist(req, res);
  if (!wishlist) return;
  res.json({ wishlist: publicWishlist(wishlist) });
});

router.patch('/:id', (req, res) => {
  const wishlist = ownWishlist(req, res);
  if (!wishlist) return;

  const wishlists = loadWishlists();
  const current = wishlists.find((w) => w.id === wishlist.id);

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
  saveWishlists(wishlists);
  res.json({ wishlist: publicWishlist(current) });
});

router.delete('/:id', (req, res) => {
  const wishlist = ownWishlist(req, res);
  if (!wishlist) return;
  saveWishlists(loadWishlists().filter((w) => w.id !== wishlist.id));
  res.json({ ok: true });
});

router.post('/:id/cards', (req, res) => {
  const wishlist = ownWishlist(req, res);
  if (!wishlist) return;

  const { card, quantity = 1 } = req.body || {};
  if (!card?.id || !card?.name) {
    return res.status(400).json({ error: 'Carta inválida' });
  }

  const qty = Math.max(1, Number(quantity) || 1);
  const wishlists = loadWishlists();
  const current = wishlists.find((w) => w.id === wishlist.id);
  const existing = current.cards.find((c) => c.id === card.id);

  if (existing) existing.quantity += qty;
  else current.cards.push(cardPayload(card, qty));

  current.updatedAt = new Date().toISOString();
  saveWishlists(wishlists);
  res.json({ wishlist: publicWishlist(current) });
});

module.exports = router;
