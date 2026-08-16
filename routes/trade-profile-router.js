const express = require('express');

const ALLOWED_FIELDS = new Set([
  'countryCode', 'region', 'city', 'latitude', 'longitude',
  'searchRadiusKm', 'tradeEnabled', 'visibility',
]);
const VISIBILITIES = new Set(['country', 'region', 'city']);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function optionalLocationText(value, field) {
  if (value === null) return null;
  if (typeof value !== 'string') throw invalid(`${field} invalido`);
  const text = value.trim();
  if (text.length > 120) throw invalid(`${field} invalido`);
  return text || null;
}

function validateChanges(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Perfil invalido');
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) throw invalid(`Campo no permitido: ${key}`);
  }

  const changes = {};
  if (body.countryCode !== undefined) {
    if (body.countryCode === null) changes.countryCode = null;
    else if (typeof body.countryCode === 'string' && /^[a-z]{2}$/i.test(body.countryCode.trim())) {
      changes.countryCode = body.countryCode.trim().toUpperCase();
    } else throw invalid('countryCode invalido');
  }
  if (body.region !== undefined) changes.region = optionalLocationText(body.region, 'region');
  if (body.city !== undefined) changes.city = optionalLocationText(body.city, 'city');
  if (body.visibility !== undefined) {
    if (!VISIBILITIES.has(body.visibility)) throw invalid('visibility invalida');
    changes.visibility = body.visibility;
  }
  if (body.tradeEnabled !== undefined) {
    if (typeof body.tradeEnabled !== 'boolean') throw invalid('tradeEnabled invalido');
    changes.tradeEnabled = body.tradeEnabled;
  }
  if (body.searchRadiusKm !== undefined) {
    if (!Number.isInteger(body.searchRadiusKm) || body.searchRadiusKm < 1 || body.searchRadiusKm > 500) {
      throw invalid('searchRadiusKm invalido');
    }
    changes.searchRadiusKm = body.searchRadiusKm;
  }

  const latitudeProvided = body.latitude !== undefined;
  const longitudeProvided = body.longitude !== undefined;
  if (latitudeProvided !== longitudeProvided) throw invalid('latitude y longitude deben enviarse juntas');
  if (latitudeProvided) {
    if (body.latitude === null && body.longitude === null) {
      changes.latitude = null;
      changes.longitude = null;
    } else if (
      typeof body.latitude === 'number' && Number.isFinite(body.latitude)
      && body.latitude >= -90 && body.latitude <= 90
      && typeof body.longitude === 'number' && Number.isFinite(body.longitude)
      && body.longitude >= -180 && body.longitude <= 180
    ) {
      changes.latitude = body.latitude;
      changes.longitude = body.longitude;
    } else throw invalid('Coordenadas invalidas');
  }
  return changes;
}

function mergeProfile(current, changes) {
  return { ...current, ...changes };
}

function validateDiscoveryReadiness(profile) {
  if (!profile.tradeEnabled) return;
  const hasCountry = Boolean(profile.countryCode);
  const hasRegion = Boolean(profile.region);
  const hasCity = Boolean(profile.city);
  if (!hasCountry
    || (profile.visibility === 'region' && !hasRegion)
    || (profile.visibility === 'city' && (!hasRegion || !hasCity))) {
    throw invalid('Completa la ubicacion visible antes de activar intercambios');
  }
}

function createTradeProfileRouter(repository) {
  if (!repository) throw new Error('Trade profile repository is required');
  const router = express.Router();

  router.get('/', asyncRoute(async (req, res) => {
    const profile = await repository.findByUserId(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ profile });
  }));

  router.patch('/', asyncRoute(async (req, res) => {
    const current = await repository.findByUserId(req.user.id);
    if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });
    const changes = validateChanges(req.body);
    validateDiscoveryReadiness(mergeProfile(current, changes));
    const profile = await repository.upsert(req.user.id, changes);
    return res.json({ profile });
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Trade profile persistence error:', error.message);
    return res.status(500).json({ error: 'No se pudo procesar el perfil de intercambio' });
  });
  return router;
}

module.exports = { createTradeProfileRouter, validateChanges, validateDiscoveryReadiness };
