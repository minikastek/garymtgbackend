/**
 * Modelo unificado de carta (guía técnica).
 * @typedef {Object} Card
 * @property {string} id
 * @property {string} name
 * @property {string} set
 * @property {string} collectorNumber
 * @property {string} rarity
 * @property {string} type
 * @property {string|null} image
 * @property {string|null} imageLarge
 * @property {string|null} oracleText
 * @property {{ cardkingdom: { retail: number|null, buylist: number|null } | null, scryfallUsd: number|null } | null} prices
 */

function emptyCard() {
  return {
    id: null,
    name: null,
    set: null,
    collectorNumber: null,
    rarity: null,
    type: null,
    image: null,
    imageLarge: null,
    oracleText: null,
    prices: null,
  };
}

module.exports = { emptyCard };
