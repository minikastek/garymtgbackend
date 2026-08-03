const express = require('express');

const router = express.Router();

router.get('/ping', (_req, res) => {
  res.json({
    ok: true,
    message: 'pong',
    service: 'garymtg-backend',
    at: new Date().toISOString(),
  });
});

router.post('/echo', (req, res) => {
  res.json({
    ok: true,
    received: req.body ?? null,
    at: new Date().toISOString(),
  });
});

router.get('/sample', (_req, res) => {
  res.json({
    ok: true,
    cards: [
      { id: 1, name: 'Lightning Bolt', type: 'Instant', mana: 'R' },
      { id: 2, name: 'Counterspell', type: 'Instant', mana: 'UU' },
      { id: 3, name: 'Sol Ring', type: 'Artifact', mana: '1' },
    ],
  });
});

module.exports = router;
