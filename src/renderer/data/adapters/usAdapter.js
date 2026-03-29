const EIA_BASE = 'https://api.eia.gov/v2/electricity/rto';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EIA error ${res.status}: ${url}`);
  return res.json();
}

// EIA fuel type codes to our internal names
const FUEL_MAP = {
  COL: 'coal',
  NG:  'gas',
  NUC: 'nuclear',
  OIL: 'oil',
  OTH: 'other',
  SUN: 'solar',
  WAT: 'hydro',
  WND: 'wind',
};

function formatEIADate(date) {
  return new Date(date).toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

export const adapter = {
  code: 'US',
  name: 'United States',
  flag: '\u{1F1FA}\u{1F1F8}',
  requiresApiKey: true,
  slotMinutes: 60,

  stackOrder: ['oil', 'other', 'coal', 'nuclear', 'gas', 'hydro', 'solar', 'wind'],
  displayOrder: ['Wind', 'Solar', 'Hydro', 'Gas', 'Nuclear', 'Coal', 'Oil', 'Other'],

  fuelColors: {
    wind:    '#FFFFFF',
    solar:   '#FFD700',
    hydro:   '#2196F3',
    gas:     '#FF9800',
    nuclear: '#9C27B0',
    coal:    '#424242',
    oil:     '#5D4037',
    other:   '#9E9E9E'
  },

  fuelLabels: {
    wind:    'Wind',
    solar:   'Solar',
    hydro:   'Hydro',
    gas:     'Gas',
    nuclear: 'Nuclear',
    coal:    'Coal',
    oil:     'Oil',
    other:   'Other'
  },

  darkTextLabels: ['Wind'],

  async fetchGenerationMix(from, to, apiKey) {
    if (!apiKey) throw new Error('EIA API key required. Register free at eia.gov/opendata/');

    const fromStr = formatEIADate(from);
    const toStr = formatEIADate(to);

    // Chunk into 5-day requests (5000 row limit / 8 fuel types / ~24 hours = ~26 days, but be safe)
    const CHUNK_MS = 5 * 24 * 60 * 60 * 1000;
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    const chunks = [];

    let cursor = fromMs;
    while (cursor < toMs) {
      const chunkEnd = Math.min(cursor + CHUNK_MS, toMs);
      chunks.push({
        start: formatEIADate(new Date(cursor)),
        end: formatEIADate(new Date(chunkEnd))
      });
      cursor = chunkEnd;
    }

    const results = await Promise.all(
      chunks.map(c => {
        const url = `${EIA_BASE}/fuel-type-data/data/?api_key=${apiKey}` +
          `&frequency=hourly&data[]=value` +
          `&facets[respondent][]=US48` +
          `&start=${c.start}&end=${c.end}` +
          `&sort[0][column]=period&sort[0][direction]=asc` +
          `&length=5000`;
        return fetchJSON(url)
          .then(r => r.response?.data || [])
          .catch(() => []);
      })
    );

    return results.flat();
  },

  parseMixData(rawData) {
    // Group by period (timestamp)
    const timeMap = new Map();
    for (const row of rawData) {
      const period = row.period; // e.g. "2026-03-28T14"
      const fuelCode = row.fueltype || row['fuel-type'] || row.fueltypeid;
      const fuel = FUEL_MAP[fuelCode];
      if (!fuel) continue;
      const mw = parseFloat(row.value);
      if (isNaN(mw)) continue;

      if (!timeMap.has(period)) timeMap.set(period, {});
      timeMap.get(period)[fuel] = (timeMap.get(period)[fuel] || 0) + mw;
    }

    // Convert to percentages
    const slots = [];
    for (const [period, fuels] of timeMap) {
      const total = Object.values(fuels).reduce((a, b) => a + Math.max(0, b), 0);
      if (total === 0) continue;
      const mix = {};
      for (const [fuel, mw] of Object.entries(fuels)) {
        mix[fuel] = Math.max(0, (mw / total) * 100);
      }
      // Parse "2026-03-28T14" to Date
      const time = new Date(period + ':00:00Z');
      slots.push({ time, mix, demandMW: null });
    }

    return slots.sort((a, b) => a.time - b.time);
  },

  async fetchDemand(from, to, apiKey) {
    if (!apiKey) return [];

    const fromStr = formatEIADate(from);
    const toStr = formatEIADate(to);

    try {
      const url = `${EIA_BASE}/region-data/data/?api_key=${apiKey}` +
        `&frequency=hourly&data[]=value` +
        `&facets[respondent][]=US48` +
        `&facets[type][]=D` +
        `&start=${fromStr}&end=${toStr}` +
        `&sort[0][column]=period&sort[0][direction]=asc` +
        `&length=5000`;
      const res = await fetchJSON(url);
      const data = res.response?.data || [];

      return data.map(d => ({
        time: new Date(d.period + ':00:00Z'),
        demandMW: parseFloat(d.value) || 0
      }));
    } catch (e) {
      console.warn('EIA demand fetch failed:', e.message);
      return [];
    }
  }
};
