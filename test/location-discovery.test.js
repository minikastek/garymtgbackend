const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { discoverUsersByLocation } = require('../src/services/location-discovery');

function user(id, username, tradeProfile = {}) {
  return { id, username, avatar: `${username}.png`, tradeProfile };
}

const requester = user('me', 'Requester', {
  countryCode: 'AR',
  region: 'Buenos Aires',
  city: 'La Plata',
});

describe('location trade discovery', () => {
  it('excludes the requester and users who did not opt into trading', () => {
    const result = discoverUsersByLocation({
      requester,
      candidates: [
        requester,
        user('disabled', 'Disabled', {
          countryCode: 'AR',
          tradeEnabled: false,
          visibility: 'country',
        }),
        user('enabled', 'Enabled', {
          countryCode: 'AR',
          tradeEnabled: true,
          visibility: 'country',
        }),
      ],
    });

    assert.deepEqual(result.users.map((candidate) => candidate.id), ['enabled']);
  });

  it('ranks city matches before region and country matches', () => {
    const result = discoverUsersByLocation({
      requester,
      candidates: [
        user('country', 'Country', {
          countryCode: 'AR', region: 'Cordoba', city: 'Cordoba', tradeEnabled: true, visibility: 'city',
        }),
        user('city', 'City', {
          countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata', tradeEnabled: true, visibility: 'city',
        }),
        user('region', 'Region', {
          countryCode: 'AR', region: 'Buenos Aires', city: 'Tandil', tradeEnabled: true, visibility: 'city',
        }),
      ],
    });

    assert.deepEqual(result.users.map((candidate) => candidate.matchLevel), ['city', 'region', 'country']);
  });

  it('does not compare or expose precision hidden by the candidate', () => {
    const result = discoverUsersByLocation({
      requester,
      candidates: [
        user('private-city', 'Private City', {
          countryCode: 'AR', region: 'Buenos Aires', city: 'La Plata', tradeEnabled: true, visibility: 'country',
        }),
      ],
    });

    assert.deepEqual(result.users[0], {
      id: 'private-city',
      username: 'Private City',
      avatar: 'Private City.png',
      matchLevel: 'country',
      location: { countryCode: 'AR' },
    });
  });

  it('paginates deterministically with a capped limit', () => {
    const candidates = Array.from({ length: 22 }, (_, index) => user(
      `user-${String(index).padStart(2, '0')}`,
      `User ${String(index).padStart(2, '0')}`,
      { countryCode: 'AR', tradeEnabled: true, visibility: 'country' },
    ));

    const first = discoverUsersByLocation({ requester, candidates, limit: 99 });
    const second = discoverUsersByLocation({ requester, candidates, limit: 99, cursor: first.nextCursor });

    assert.equal(first.users.length, 20);
    assert.equal(first.nextCursor, 'user-19');
    assert.deepEqual(second.users.map((candidate) => candidate.id), ['user-20', 'user-21']);
    assert.equal(second.nextCursor, null);
  });

  it('rejects an unknown cursor', () => {
    assert.throws(
      () => discoverUsersByLocation({ requester, candidates: [], cursor: 'missing' }),
      /Invalid location discovery cursor/,
    );
  });
});
