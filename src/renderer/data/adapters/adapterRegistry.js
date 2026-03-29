import { adapter as ukAdapter } from './ukAdapter.js';
import { adapter as deAdapter } from './deAdapter.js';
import { adapter as usAdapter } from './usAdapter.js';

const ADAPTERS = {
  UK: ukAdapter,
  DE: deAdapter,
  US: usAdapter,
};

let activeAdapter = null;

export function getAvailableCountries() {
  return Object.values(ADAPTERS).map(a => ({
    code: a.code,
    name: a.name,
    flag: a.flag
  }));
}

export function loadAdapter(code) {
  const adapter = ADAPTERS[code];
  if (!adapter) throw new Error(`Unknown country: ${code}`);
  activeAdapter = adapter;
  return adapter;
}

export function getActiveAdapter() {
  return activeAdapter;
}
