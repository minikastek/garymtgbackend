/**
 * Une Scryfall + Card Kingdom con clave name + set + collector_number.
 */
function normalizeCard(scryfallCard, cardKingdomData) {
  const ck = cardKingdomData
    ? {
        retail: cardKingdomData.price ?? null,
        buylist: cardKingdomData.buy_price ?? null,
      }
    : null;

  const hasAnyPrice = ck || scryfallCard.prices?.usd != null;

  return {
    id: scryfallCard.id,
    name: scryfallCard.name,
    set: scryfallCard.set,
    collectorNumber: scryfallCard.collector_number,
    rarity: scryfallCard.rarity,
    type: scryfallCard.type_line,
    image: scryfallCard.image_uris?.normal || null,
    imageLarge: scryfallCard.image_uris?.large || null,
    oracleText: scryfallCard.oracle_text,
    prices: hasAnyPrice
      ? {
          cardkingdom: ck,
          scryfallUsd: scryfallCard.prices?.usd ?? null,
        }
      : null,
  };
}

module.exports = { normalizeCard };
