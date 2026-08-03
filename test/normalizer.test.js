const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCard } = require('../src/utils/normalizer');

describe('normalizeCard', () => {
  it('normaliza scryfall + card kingdom', () => {
    const card = normalizeCard(
      {
        id: 'abc',
        name: 'Lightning Bolt',
        set: 'LEA',
        collector_number: '161',
        rarity: 'common',
        type_line: 'Instant',
        oracle_text: 'Deal 3 damage.',
        image_uris: { normal: 'https://img/normal.jpg', large: 'https://img/large.jpg' },
        prices: { usd: 1.5 },
      },
      { price: 2.99, buy_price: 1.1 },
    );

    assert.equal(card.name, 'Lightning Bolt');
    assert.equal(card.set, 'LEA');
    assert.equal(card.collectorNumber, '161');
    assert.equal(card.image, 'https://img/normal.jpg');
    assert.equal(card.prices.cardkingdom.retail, 2.99);
    assert.equal(card.prices.cardkingdom.buylist, 1.1);
    assert.equal(card.prices.scryfallUsd, 1.5);
  });

  it('sin precio CK ni scryfall => prices null', () => {
    const card = normalizeCard(
      {
        id: 'x',
        name: 'Test',
        set: 'TST',
        collector_number: '1',
        rarity: 'rare',
        type_line: 'Creature',
        oracle_text: null,
        image_uris: { normal: null, large: null },
        prices: { usd: null },
      },
      null,
    );
    assert.equal(card.prices, null);
  });
});
