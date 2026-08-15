function normalizeCard(card, quantity = card?.quantity) {
  return {
    id: String(card.id),
    name: String(card.name),
    set: card.set || null,
    collectorNumber: card.collectorNumber || null,
    rarity: card.rarity || null,
    type: card.type || null,
    image: card.image || null,
    imageLarge: card.imageLarge || null,
    prices: card.prices || null,
    quantity: Math.max(1, Number(quantity) || 1),
  };
}

function normalizeBinder(value) {
  const cards = Array.isArray(value.cards) ? value.cards.map((card) => normalizeCard(card)) : [];
  return {
    id: String(value.id),
    userId: String(value.userId),
    name: String(value.name),
    description: String(value.description || ''),
    cards,
    cardCount: cards.reduce((total, card) => total + (Number(card.quantity) || 0), 0),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

module.exports = { normalizeBinder, normalizeCard };
