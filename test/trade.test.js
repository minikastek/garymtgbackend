const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cardKey, compareCollections } = require('../src/services/trade-match');

describe('trade name match', () => {
  it('ignora edición y normaliza nombre', () => {
    assert.equal(cardKey('Lightning Bolt'), cardKey('Lightning Bolt'));
    assert.equal(cardKey('Lightning Bolt'), 'lightning bolt');
    assert.equal(cardKey('Emeritus // Lightning Bolt'), 'emeritus');
  });

  it('detecta match binder vs wishlist por nombre', () => {
    const wishlist = [{ name: 'Sol Ring', set: 'C21', quantity: 1 }];
    const binder = [
      { name: 'Sol Ring', set: 'MH3', quantity: 2 },
      { name: 'Counterspell', set: 'MH2', quantity: 1 },
    ];
    const matches = compareCollections(binder, wishlist);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Sol Ring');
    assert.equal(matches[0].binderQuantity, 2);
    assert.equal(matches[0].wishlistQuantity, 1);
    assert.equal(matches[0].binderPrintings[0].set, 'MH3');
  });
});
