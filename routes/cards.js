const express = require('express');
const scryfall = require('../src/services/scryfall.service');
const cardkingdom = require('../src/services/cardkingdom.service');
const { normalizeCard } = require('../src/utils/normalizer');

const router = express.Router();

/** GET /api/cards?name=black+lotus */
router.get('/', async (req, res) => {
  const name = req.query.name || req.query.q;
  if (!name) {
    return res.status(400).json({ error: 'Parámetro name requerido' });
  }

  try {
    const results = await scryfall.searchCards(name);
    const cards = await Promise.all(
      results.map(async (sf) => {
        const ck = await cardkingdom.findPrice({
          scryfallId: sf.id,
          name: sf.name,
          set: sf.set,
        });
        return normalizeCard(sf, ck);
      }),
    );
    res.json({ cards });
  } catch (err) {
    console.error('cards search error', err.message);
    res.status(err.status === 404 ? 404 : 502).json({ error: err.message || 'Error buscando cartas' });
  }
});

module.exports = router;
