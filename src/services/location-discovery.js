const MATCH_SCORE = Object.freeze({ country: 1, region: 2, city: 3 });
const MAX_RESULTS = 20;

function clean(value) {
  return String(value || '').trim();
}

function comparable(value) {
  return clean(value).toLocaleLowerCase('en-US');
}

function normalizeProfile(user) {
  const profile = user?.tradeProfile || {};
  const requestedVisibility = Object.hasOwn(MATCH_SCORE, profile.visibility)
    ? profile.visibility
    : 'country';

  return {
    countryCode: clean(profile.countryCode).toUpperCase(),
    region: clean(profile.region),
    city: clean(profile.city),
    tradeEnabled: profile.tradeEnabled === true,
    visibility: requestedVisibility,
  };
}

function visibleLocation(profile) {
  const location = { countryCode: profile.countryCode };
  if (MATCH_SCORE[profile.visibility] >= MATCH_SCORE.region && profile.region) {
    location.region = profile.region;
  }
  if (MATCH_SCORE[profile.visibility] >= MATCH_SCORE.city && profile.city) {
    location.city = profile.city;
  }
  return location;
}

function toCandidate(requester, candidate) {
  if (!candidate || candidate.id === requester?.id) return null;

  const requesterProfile = normalizeProfile(requester);
  const candidateProfile = normalizeProfile(candidate);
  if (!candidateProfile.tradeEnabled || !requesterProfile.countryCode || !candidateProfile.countryCode) {
    return null;
  }
  if (comparable(requesterProfile.countryCode) !== comparable(candidateProfile.countryCode)) {
    return null;
  }

  let matchLevel = 'country';
  const canMatchRegion = MATCH_SCORE[candidateProfile.visibility] >= MATCH_SCORE.region
    && requesterProfile.region
    && candidateProfile.region
    && comparable(requesterProfile.region) === comparable(candidateProfile.region);
  if (canMatchRegion) matchLevel = 'region';

  const canMatchCity = canMatchRegion
    && MATCH_SCORE[candidateProfile.visibility] >= MATCH_SCORE.city
    && requesterProfile.city
    && candidateProfile.city
    && comparable(requesterProfile.city) === comparable(candidateProfile.city);
  if (canMatchCity) matchLevel = 'city';

  return {
    id: candidate.id,
    username: candidate.username,
    avatar: candidate.avatar,
    matchLevel,
    location: visibleLocation(candidateProfile),
  };
}

function compareCandidates(a, b) {
  const scoreDifference = MATCH_SCORE[b.matchLevel] - MATCH_SCORE[a.matchLevel];
  if (scoreDifference !== 0) return scoreDifference;

  const usernameDifference = clean(a.username).localeCompare(clean(b.username), 'en-US', {
    sensitivity: 'base',
  });
  if (usernameDifference !== 0) return usernameDifference;
  return clean(a.id).localeCompare(clean(b.id), 'en-US');
}

function discoverUsersByLocation({ requester, candidates = [], cursor, limit = MAX_RESULTS }) {
  const boundedLimit = Math.min(MAX_RESULTS, Math.max(1, Number.parseInt(limit, 10) || MAX_RESULTS));
  const ranked = candidates
    .map((candidate) => toCandidate(requester, candidate))
    .filter(Boolean)
    .sort(compareCandidates);

  let start = 0;
  if (cursor) {
    const cursorIndex = ranked.findIndex((candidate) => candidate.id === cursor);
    if (cursorIndex < 0) throw new Error('Invalid location discovery cursor');
    start = cursorIndex + 1;
  }

  const users = ranked.slice(start, start + boundedLimit);
  const hasMore = start + users.length < ranked.length;
  return {
    users,
    nextCursor: hasMore ? users.at(-1).id : null,
  };
}

module.exports = {
  MAX_RESULTS,
  discoverUsersByLocation,
  normalizeProfile,
};
