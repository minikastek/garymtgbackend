function monitoringEnabled() {
  return /^(1|true|yes|on)$/i.test(process.env.REQUEST_LOGGING || '');
}

function elapsedMilliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function logRequest(prefix, method, target, status, duration) {
  const timestamp = new Date().toISOString();
  console.log(`[${prefix}] ${timestamp} ${method} ${target} ${status} ${duration.toFixed(1)}ms`);
}

function requestMonitor(req, res, next) {
  if (!monitoringEnabled()) return next();

  const startedAt = process.hrtime.bigint();
  res.once('finish', () => {
    logRequest('API', req.method, req.originalUrl, res.statusCode, elapsedMilliseconds(startedAt));
  });

  return next();
}

async function monitoredFetch(provider, url, options = {}) {
  if (!monitoringEnabled()) return fetch(url, options);

  const startedAt = process.hrtime.bigint();
  const method = String(options.method || 'GET').toUpperCase();

  try {
    const response = await fetch(url, options);
    logRequest(`OUT:${provider}`, method, url, response.status, elapsedMilliseconds(startedAt));
    return response;
  } catch (error) {
    logRequest(`OUT:${provider}`, method, url, 'ERROR', elapsedMilliseconds(startedAt));
    throw error;
  }
}

module.exports = { monitoredFetch, monitoringEnabled, requestMonitor };
