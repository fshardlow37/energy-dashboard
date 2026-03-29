import { fetchGenerationMix, fetchDemand } from './api.js';
import { getCachedRange, setCachedDay } from './cache.js';

export const FUEL_TYPES = ['nuclear', 'wind', 'solar', 'hydro', 'biomass', 'imports', 'gas', 'coal', 'other'];

let dataSlots = [];
let earliestLoaded = null;
let latestLoaded = null;
let isLoading = false;
let listeners = [];

export function onDataChange(fn) { listeners.push(fn); }
function emit() { listeners.forEach(fn => fn(dataSlots)); }

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
}

function alignTo30Min(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() >= 30 ? 30 : 0, 0, 0);
  return d;
}

function parseMixData(rawData) {
  const slots = [];
  for (const entry of rawData) {
    if (!entry.from || !entry.generationmix) continue;
    const time = new Date(entry.from);
    const mix = {};
    for (const fuel of entry.generationmix) {
      mix[fuel.fuel] = fuel.perc;
    }
    slots.push({ time, mix, demandMW: null });
  }
  return slots;
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
    const aligned = alignTo30Min(d.time);
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
      fetchGenerationMix(threeDaysAgo, now),
      fetchDemand(threeDaysAgo, now)
    ]);

    const mixSlots = parseMixData(mixRaw);
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
      fetchGenerationMix(from, to),
      fetchDemand(from, to)
    ]);

    const mixSlots = parseMixData(mixRaw);
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
  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    const [mixRaw, demandRaw] = await Promise.all([
      fetchGenerationMix(thirtyMinAgo, now),
      fetchDemand(thirtyMinAgo, now)
    ]);

    const mixSlots = parseMixData(mixRaw);
    const merged = mergeSlots(dataSlots, mixSlots);
    mergeDemand(merged, demandRaw);
    dataSlots = merged;
    latestLoaded = now;
    emit();
  } catch (e) {
    console.warn('Refresh failed:', e.message);
  }
}

export function getSlots() { return dataSlots; }
export function getEarliestLoaded() { return earliestLoaded; }
