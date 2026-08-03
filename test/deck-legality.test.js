const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLegality, isBasicLand, maxCopiesFor } = require('../src/utils/deck-legality');

describe('deck legality', () => {
  it('detecta tierras básicas por nombre', () => {
    assert.equal(isBasicLand({ name: 'Mountain', type: 'Basic Land — Mountain' }), true);
    assert.equal(isBasicLand({ name: 'Plains', type: 'Basic Land — Plains' }), true);
    assert.equal(isBasicLand({ name: 'Lightning Bolt', type: 'Instant' }), false);
    assert.equal(maxCopiesFor({ name: 'Mountain', type: 'Basic Land — Mountain' }), 999);
    assert.equal(maxCopiesFor({ name: 'Bolt', type: 'Instant' }), 4);
  });

  it('deck vacío: faltan 60 en main', () => {
    const L = evaluateLegality({ main: [], sideboard: [] });
    assert.equal(L.legal, false);
    assert.equal(L.mainNeeded, 60);
    assert.equal(L.sideboardOver, 0);
  });

  it('main 60 y side ≤15 es legal', () => {
    const main = Array.from({ length: 60 }, (_, i) => ({
      name: i < 20 ? 'Mountain' : `Card ${i}`,
      type: i < 20 ? 'Basic Land — Mountain' : 'Creature',
      quantity: 1,
    }));
    const L = evaluateLegality({ main, sideboard: [{ name: 'Bolt', type: 'Instant', quantity: 4 }] });
    assert.equal(L.mainCount, 60);
    assert.equal(L.legal, true);
  });

  it('sideboard > 15 no es legal', () => {
    const main = Array.from({ length: 60 }, () => ({
      name: 'Mountain',
      type: 'Basic Land — Mountain',
      quantity: 1,
    }));
    const sideboard = Array.from({ length: 16 }, (_, i) => ({
      name: `SB ${i}`,
      type: 'Instant',
      quantity: 1,
    }));
    const L = evaluateLegality({ main, sideboard });
    assert.equal(L.legal, false);
    assert.equal(L.sideboardOver, 1);
  });

  it('más de 4 copias (main+side) no es legal', () => {
    const main = [
      ...Array.from({ length: 56 }, () => ({ name: 'Mountain', type: 'Basic Land — Mountain', quantity: 1 })),
      { name: 'Lightning Bolt', type: 'Instant', quantity: 4 },
    ];
    const sideboard = [{ name: 'Lightning Bolt', type: 'Instant', quantity: 1 }];
    const L = evaluateLegality({ main, sideboard });
    assert.equal(L.legal, false);
    assert.ok(L.copyViolations.some((v) => v.name === 'Lightning Bolt'));
  });
});
