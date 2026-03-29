import { loadAdapter, getActiveAdapter } from './adapters/adapterRegistry.js';
import { getCachedRange, setCachedDay, setCountryPrefix } from './cache.js';

let dataSlots = [];
let earliestLoaded = null;
let latestLoaded = null;
let isLoading = false;
let listeners = [];
let currentApiKey = null;

export function onDataChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => fn(dataSlots)); }

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
}

function alignToSlot(date) {
  const adapter = getActiveAdapter();
  const mins = adapter ? adapter.slotMinutes : 30;
  const d = new Date(date);
  const m = d.getMinutes();
  d.setMinutes(Math.floor(m / mins) * mins, 0, 0);
  return d;
}

function mergeSlots(existing, incoming) {
  const map = new Map();
  for (const slot of existing) {
    map.set(slot.time.getTime(), slot);
  }
  for (const slot of incoming) {
    const key = slot.time.getTime();
    const prev = map.get(key);
    if (prev) {
      if (slot.mix) prev.mix = slot.mix;
      if (slot.demandMW !== null) prev.demandMW = slot.demandMW;
    } else {
      map.set(key, { ...slot });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function mergeDemand(slots, demandData) {
  const demandMap = new Map();
  for (const d of demandData) {
    const aligned = alignToSlot(d.time);
    demandMap.set(aligned.getTime(), d.demandMW);
  }
  for (const slot of slots) {
    const key = slot.time.getTime();
    if (demandMap.has(key)) {
      slot.demandMW = demandMap.get(key);
    }
  }
  return slots;
}

function cacheSlots(slots) {
  const byDay = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const slot of slots) {
    const key = slot.time.toISOString().slice(0, 10);
    if (key === today) continue;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push({
      time: slot.time.toISOString(),
      mix: slot.mix,
      demandMW: slot.demandMW
    });
  }
  for (const [day, daySlots] of Object.entries(byDay)) {
    setCachedDay(day, daySlots);
  }
}

function deserializeCached(cached) {
  return cached.map(s => ({
    time: new Date(s.time),
    mix: s.mix,
    demandMW: s.demandMW
  }));
}

export async function initialize() {
  const adapter = getActiveAdapter();
  if (!adapter) return;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  earliestLoaded = threeDaysAgo;
  latestLoaded = now;

  const cached = getCachedRange(threeDaysAgo, now);
  if (cached.length > 0) {
    dataSlots = deserializeCached(cached);
    emit();
  }

  showLoading(true);

  try {
    const [mixRaw, demandRaw] = await Promise.all([
      adapter.fetchGenerationMix(threeDaysAgo, now, currentApiKey),
      adapter.fetchDemand(threeDaysAgo, now, currentApiKey)
    ]);

    const mixSlots = adapter.parseMixData(mixRaw);
    const merged = mergeSlots(dataSlots, mixSlots);
    mergeDemand(merged, demandRaw);
    dataSlots = merged;
    cacheSlots(dataSlots);
    emit();
  } catch (e) {
    console.error('Failed to fetch initial data:', e);
  }

  showLoading(false);
}

export async function loadMore(direction, days = 7) {
  if (isLoading) return;
  const adapter = getActiveAdapter();
  if (!adapter) return;

  isLoading = true;
  showLoading(true);

  try {
    let from, to;
    if (direction === 'left') {
      to = new Date(earliestLoaded);
      from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      earliestLoaded = from;
    } else {
      from = new Date(latestLoaded);
      to = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
      latestLoaded = to;
    }

    const cached = getCachedRange(from, to);
    if (cached.length > 0) {
      dataSlots = mergeSlots(dataSlots, deserializeCached(cached));
    }

    const [mixRaw, demandRaw] = await Promise.all([
      adapter.fetchGenerationMix(from, to, currentApiKey),
      adapter.fetchDemand(from, to, currentApiKey)
    ]);

    const mixSlots = adapter.parseMixData(mixRaw);
    const merged = mergeSlots(dataSlots, mixSlots);
    mergeDemand(merged, demandRaw);
    dataSlots = merged;
    cacheSlots(dataSlots);
    emit();
  } catch (e) {
    console.error('Failed to load more data:', e);
  }

  isLoading = false;
  showLoading(false);
}

export async function refresh() {
  const adapter = getActiveAdapter();
  if (!adapter) return;

  const now = new Date();
  const slotMs = adapter.slotMinutes * 60 * 1000;
  const recentStart = new Date(now.getTime() - slotMs);

  try {
    const [mixRaw, demandRaw] = await Promise.all([
      adapter.fetchGenerationMix(recentStart, now, currentApiKey),
      adapter.fetchDemand(recentStart, now, currentApiKey)
    ]);

    const mixSlots = adapter.parseMixData(mixRaw);
    const merged = mergeSlots(dataSlots, mixSlots);
    mergeDemand(merged, demandRaw);
    dataSlots = merged;
    latestLoaded = now;
    emit();
  } catch (e) {
    console.warn('Refresh failed:', e.message);
  }
}

export async function switchCountry(code, apiKey) {
  dataSlots = [];
  earliestLoaded = null;
  latestLoaded = null;
  currentApiKey = apiKey;
  emit();

  setCountryPrefix(code);
  loadAdapter(code);
  await initialize();
}

export function getSlots() { return dataSlots; }
export function getEarliestLoaded() { return earliestLoaded; }
