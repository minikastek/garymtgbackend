const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function cardKey(name) {
  return String(name || '')
    .toLowerCase()
    .split(' // ')[0]
    .trim();
}

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
    const wanted = new Set(wishlist.map((c) => cardKey(c.name)));
    const matches = binder.filter((c) => wanted.has(cardKey(c.name)));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].set, 'MH3');
  });
});
