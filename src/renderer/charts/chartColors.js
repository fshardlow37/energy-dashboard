import { getActiveAdapter } from '../data/adapters/adapterRegistry.js';

export function getFuelColors() { return getActiveAdapter()?.fuelColors || {}; }
export function getFuelLabels() { return getActiveAdapter()?.fuelLabels || {}; }

// Kept for backward compat — these now read dynamically
export const FUEL_COLORS = new Proxy({}, { get: (_, k) => getFuelColors()[k] });
export const FUEL_LABELS = new Proxy({}, { get: (_, k) => getFuelLabels()[k] });
