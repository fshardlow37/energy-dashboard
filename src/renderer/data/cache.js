let countryPrefix = 'UK';
const MAX_AGE_DAYS = 90;

function cacheKey() {
  return `energysrc-cache-${countryPrefix}`;
}

export function setCountryPrefix(code) {
  countryPrefix = code;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(cache));
  } catch {
    evictOldEntries(cache);
    try { localStorage.setItem(cacheKey(), JSON.stringify(cache)); } catch {}
  }
}

function evictOldEntries(cache) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(cache)) {
    if (key < cutoffStr) delete cache[key];
  }
}

export function getCachedRange(from, to) {
  const cache = loadCache();
  const results = [];
  const cursor = new Date(from);
  const toDate = new Date(to);

  while (cursor <= toDate) {
    const key = cursor.toISOString().slice(0, 10);
    if (cache[key]) results.push(...cache[key]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

export function setCachedDay(dateStr, slots) {
  const cache = loadCache();
  cache[dateStr] = slots;
  evictOldEntries(cache);
  saveCache(cache);
}
