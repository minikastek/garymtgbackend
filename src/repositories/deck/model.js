function normalizeCard(card) {
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
    quantity: Math.max(1, Number(card.quantity) || 1),
  };
}

function normalizeDeck(value) {
  return {
    id: String(value.id),
    userId: String(value.userId),
    name: String(value.name),
    main: Array.isArray(value.main) ? value.main.map(normalizeCard) : [],
    sideboard: Array.isArray(value.sideboard) ? value.sideboard.map(normalizeCard) : [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

module.exports = { normalizeCard, normalizeDeck };
