const CI_BASE = 'https://api.carbonintensity.org.uk';
const ELEXON_BASE = 'https://data.elexon.co.uk/bmrs/api/v1';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

export async function fetchGenerationMix(from, to) {
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
          // API returns array for ranges, single object for current
          return Array.isArray(d) ? d : d ? [d] : [];
        })
        .catch(() => [])
    )
  );

  return results.flat();
}

export async function fetchDemand(from, to) {
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
