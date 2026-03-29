const SMARD_BASE = 'https://www.smard.de/app/chart_data';

// SMARD filter IDs for generation by fuel type
const FUEL_FILTERS = {
  biomass:       4169,
  hydro:         4067,
  wind_offshore: 1225,
  wind_onshore:  4068,
  solar:         4069,
  nuclear:       1224,
  lignite:       1226,
  hard_coal:     1227,
  gas:           4071,
  pump_storage:  4070,
  other:         1228,
};
const LOAD_FILTER = 410;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SMARD error ${res.status}: ${url}`);
  return res.json();
}

// Find the timestamp block that covers a date range
async function getTimestampForRange(filter, from) {
  const indexUrl = `${SMARD_BASE}/${filter}/DE/index_hour.json`;
  const index = await fetchJSON(indexUrl);
  const timestamps = index.timestamps || [];
  // Find the latest timestamp <= from
  const fromMs = new Date(from).getTime();
  let best = timestamps[0];
  for (const ts of timestamps) {
    if (ts <= fromMs) best = ts;
    else break;
  }
  return best;
}

// Fetch a single fuel filter's data for a timestamp block
async function fetchFilterData(filter, timestamp) {
  const url = `${SMARD_BASE}/${filter}/DE/${filter}_DE_hour_${timestamp}.json`;
  try {
    const data = await fetchJSON(url);
    return data.series || [];
  } catch {
    return [];
  }
}

export const adapter = {
  code: 'DE',
  name: 'Germany',
  flag: '\u{1F1E9}\u{1F1EA}',
  requiresApiKey: false,
  slotMinutes: 60,

  stackOrder: ['pump_storage', 'other', 'hard_coal', 'lignite', 'nuclear', 'gas', 'biomass', 'hydro', 'solar', 'wind_onshore', 'wind_offshore'],
  displayOrder: ['Wind Offshore', 'Wind Onshore', 'Solar', 'Hydro', 'Biomass', 'Gas', 'Nuclear', 'Lignite', 'Hard Coal', 'Pump Storage', 'Other'],

  fuelColors: {
    wind_offshore: '#80DEEA',
    wind_onshore:  '#FFFFFF',
    solar:         '#FFD700',
    hydro:         '#2196F3',
    biomass:       '#2E7D32',
    gas:           '#FF9800',
    nuclear:       '#9C27B0',
    lignite:       '#795548',
    hard_coal:     '#424242',
    pump_storage:  '#00BCD4',
    other:         '#9E9E9E'
  },

  fuelLabels: {
    wind_offshore: 'Wind Offshore',
    wind_onshore:  'Wind Onshore',
    solar:         'Solar',
    hydro:         'Hydro',
    biomass:       'Biomass',
    gas:           'Gas',
    nuclear:       'Nuclear',
    lignite:       'Lignite',
    hard_coal:     'Hard Coal',
    pump_storage:  'Pump Storage',
    other:         'Other'
  },

  darkTextLabels: ['Wind Onshore'],

  async fetchGenerationMix(from, to) {
    // Get the timestamp block that covers our range
    const firstFilter = Object.values(FUEL_FILTERS)[0];
    const timestamp = await getTimestampForRange(firstFilter, from);

    // Fetch all fuel types in parallel
    const entries = Object.entries(FUEL_FILTERS);
    const results = await Promise.all(
      entries.map(([fuel, filter]) =>
        fetchFilterData(filter, timestamp).then(series => ({ fuel, series }))
      )
    );

    // Also try the next timestamp block if our range spans it
    const nextTimestamp = timestamp + 7 * 24 * 60 * 60 * 1000; // SMARD blocks are weekly
    const toMs = new Date(to).getTime();
    let extraResults = [];
    if (nextTimestamp < toMs + 24 * 60 * 60 * 1000) {
      extraResults = await Promise.all(
        entries.map(([fuel, filter]) =>
          fetchFilterData(filter, nextTimestamp).then(series => ({ fuel, series }))
        )
      );
    }

    // Merge results
    for (let i = 0; i < entries.length; i++) {
      if (extraResults[i]) {
        results[i].series = results[i].series.concat(extraResults[i].series);
      }
    }

    return { results, from, to };
  },

  parseMixData(rawData) {
    const { results, from, to } = rawData;
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();

    // Build a map: timestamp -> { fuel: mw }
    const timeMap = new Map();
    for (const { fuel, series } of results) {
      for (const [ts, mw] of series) {
        if (ts < fromMs || ts > toMs) continue;
        if (mw === null) continue;
        if (!timeMap.has(ts)) timeMap.set(ts, {});
        timeMap.get(ts)[fuel] = mw;
      }
    }

    // Convert MW to percentages
    const slots = [];
    for (const [ts, fuels] of timeMap) {
      const total = Object.values(fuels).reduce((a, b) => a + Math.max(0, b), 0);
      if (total === 0) continue;
      const mix = {};
      for (const [fuel, mw] of Object.entries(fuels)) {
        mix[fuel] = Math.max(0, (mw / total) * 100);
      }
      slots.push({ time: new Date(ts), mix, demandMW: null });
    }

    return slots.sort((a, b) => a.time - b.time);
  },

  async fetchDemand(from, to) {
    try {
      const timestamp = await getTimestampForRange(LOAD_FILTER, from);
      let series = await fetchFilterData(LOAD_FILTER, timestamp);

      // Try next block too
      const nextTimestamp = timestamp + 7 * 24 * 60 * 60 * 1000;
      const toMs = new Date(to).getTime();
      if (nextTimestamp < toMs + 24 * 60 * 60 * 1000) {
        const extra = await fetchFilterData(LOAD_FILTER, nextTimestamp);
        series = series.concat(extra);
      }

      const fromMs = new Date(from).getTime();
      return series
        .filter(([ts, mw]) => ts >= fromMs && ts <= toMs && mw !== null)
        .map(([ts, mw]) => ({ time: new Date(ts), demandMW: mw }));
    } catch (e) {
      console.warn('SMARD demand fetch failed:', e.message);
      return [];
    }
  }
};
