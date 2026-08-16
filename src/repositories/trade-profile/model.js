const VISIBILITIES = new Set(['country', 'region', 'city']);

function optionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function coordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function normalizeTradeProfile(value = {}) {
  const countryCode = String(value.countryCode || '').trim().toUpperCase();
  const latitude = coordinate(value.latitude, -90, 90);
  const longitude = coordinate(value.longitude, -180, 180);
  const hasCoordinatePair = latitude !== null && longitude !== null;
  const requestedRadius = Number.parseInt(value.searchRadiusKm, 10);

  return {
    userId: String(value.userId),
    countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
    region: optionalText(value.region),
    city: optionalText(value.city),
    latitude: hasCoordinatePair ? latitude : null,
    longitude: hasCoordinatePair ? longitude : null,
    searchRadiusKm: Number.isFinite(requestedRadius)
      ? Math.min(500, Math.max(1, requestedRadius))
      : 25,
    tradeEnabled: value.tradeEnabled === true,
    visibility: VISIBILITIES.has(value.visibility) ? value.visibility : 'country',
    updatedAt: value.updatedAt,
  };
}

function mergeDefined(current, changes) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(changes || {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

module.exports = { normalizeTradeProfile, mergeDefined };
