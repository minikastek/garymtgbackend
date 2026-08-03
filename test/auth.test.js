const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'garymtg-dev-secret';

describe('auth helpers', () => {
  it('hashea y verifica password', async () => {
    const hash = await bcrypt.hash('secret1', 10);
    assert.equal(await bcrypt.compare('secret1', hash), true);
    assert.equal(await bcrypt.compare('wrong', hash), false);
  });

  it('firma y verifica jwt', () => {
    const token = jwt.sign({ id: '1', username: 'gary' }, JWT_SECRET, { expiresIn: '1h' });
    const payload = jwt.verify(token, JWT_SECRET);
    assert.equal(payload.username, 'gary');
  });
});
