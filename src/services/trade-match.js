function publicUser(user) {
  return { id: user.id, username: user.username, avatar: user.avatar || null };
}

function cardKey(name) {
  return String(name || '')
    .toLowerCase()
    .split(' // ')[0]
    .trim();
}

function countCards(cards) {
  return (cards || []).reduce((total, card) => total + (Number(card.quantity) || 0), 0);
}

function compareCollections(binderCards, wishlistCards) {
  const wanted = new Map();
  for (const card of wishlistCards || []) {
    const key = cardKey(card.name);
    if (!key) continue;

    const current = wanted.get(key) || {
      name: String(card.name || '').split(' // ')[0],
      quantity: 0,
      printings: [],
    };
    current.quantity += Number(card.quantity) || 0;
    current.printings.push({
      id: card.id,
      set: card.set,
      collectorNumber: card.collectorNumber,
      image: card.image,
      quantity: card.quantity,
    });
    wanted.set(key, current);
  }

  const matches = new Map();
  for (const card of binderCards || []) {
    const key = cardKey(card.name);
    if (!wanted.has(key)) continue;

    const wantedCard = wanted.get(key);
    const current = matches.get(key) || {
      name: wantedCard.name,
      wishlistQuantity: wantedCard.quantity,
      binderQuantity: 0,
      binderPrintings: [],
      wishlistPrintings: wantedCard.printings,
    };
    current.binderQuantity += Number(card.quantity) || 0;
    current.binderPrintings.push({
      id: card.id,
      set: card.set,
      collectorNumber: card.collectorNumber,
      image: card.image,
      rarity: card.rarity,
      quantity: card.quantity,
    });
    matches.set(key, current);
  }

  return [...matches.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { cardKey, compareCollections, countCards, publicUser };
