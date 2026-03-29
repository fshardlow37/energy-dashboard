const CI_BASE = 'https://api.carbonintensity.org.uk';
const ELEXON_BASE = 'https://data.elexon.co.uk/bmrs/api/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

export const adapter = {
  code: 'UK',
  name: 'United Kingdom',
  flag: '\u{1F1EC}\u{1F1E7}',
  requiresApiKey: false,
  slotMinutes: 30,

  stackOrder: ['hydro', 'coal', 'biomass', 'nuclear', 'imports', 'gas', 'solar', 'wind', 'other'],
  displayOrder: ['Wind', 'Solar', 'Gas', 'Imports', 'Nuclear', 'Biomass', 'Coal', 'Hydro', 'Other'],

  fuelColors: {
    nuclear: '#9C27B0',
    wind:    '#FFFFFF',
    solar:   '#FFD700',
    hydro:   '#2196F3',
    biomass: '#2E7D32',
    imports: '#F44336',
    gas:     '#FF9800',
    coal:    '#424242',
    other:   '#9E9E9E'
  },

  fuelLabels: {
    nuclear: 'Nuclear',
    wind:    'Wind',
    solar:   'Solar',
    hydro:   'Hydro',
    biomass: 'Biomass',
    imports: 'Imports',
    gas:     'Gas',
    coal:    'Coal',
    other:   'Other'
  },

  // Label styling: which labels get dark text (for light backgrounds)
  darkTextLabels: ['Wind'],

  async fetchGenerationMix(from, to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const CHUNK_MS = 14 * 24 * 60 * 60 * 1000;
    const chunks = [];

    let cursor = fromDate.getTime();
    while (cursor < toDate.getTime()) {
      const chunkEnd = Math.min(cursor + CHUNK_MS, toDate.getTime());
      chunks.push({
        from: new Date(cursor).toISOString(),
        to: new Date(chunkEnd).toISOString()
      });
      cursor = chunkEnd;
    }

    const results = await Promise.all(
      chunks.map(c =>
        fetchJSON(`${CI_BASE}/generation/${c.from}/${c.to}`)
          .then(r => {
            const d = r.data;
            return Array.isArray(d) ? d : d ? [d] : [];
          })
          .catch(() => [])
      )
    );

    return results.flat();
  },

  parseMixData(rawData) {
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
  },

  async fetchDemand(from, to) {
    const fromISO = new Date(from).toISOString();
    const toISO = new Date(to).toISOString();
    const url = `${ELEXON_BASE}/demand/total/actual?from=${fromISO}&to=${toISO}&format=json`;

    try {
      const data = await fetchJSON(url);
      return (data.data || data || []).map(d => ({
        time: new Date(d.startTime || d.settlementDate),
        demandMW: d.demand || d.quantity || 0
      }));
    } catch (e) {
      console.warn('Elexon demand fetch failed:', e.message);
      return [];
    }
  }
};
