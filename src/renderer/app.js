import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend, zoomPlugin);
Chart.defaults.color = '#888';
Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";

import { initTitlebar } from './titlebar.js';
import { createDemandChart, updateDemandData, destroyDemandChart } from './charts/demandChart.js';
import { createMixChart, updateMixData, destroyMixChart } from './charts/mixChart.js';
import { getAvailableCountries, loadAdapter } from './data/adapters/adapterRegistry.js';
import { initCountrySelector, setCountrySelector } from './ui/countrySelector.js';
import { showApiKeyPrompt } from './ui/apiKeyPrompt.js';
import * as dataManager from './data/dataManager.js';

let currentCountry = 'UK';
let refreshInterval = null;

function startRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => dataManager.refresh(), 5 * 60 * 1000);
}

function onDataChange(slots) {
  updateDemandData(slots);
  updateMixData(slots);
}

async function handleCountryChange(code) {
  if (code === currentCountry) return;

  const adapter = loadAdapter(code);
  let apiKey = null;

  if (adapter.requiresApiKey) {
    apiKey = await window.energysrc.getApiKey(code);
    if (!apiKey) {
      apiKey = await showApiKeyPrompt(adapter.name);
      if (!apiKey) {
        // Cancelled — revert selector
        setCountrySelector(currentCountry);
        return;
      }
      await window.energysrc.setApiKey(code, apiKey);
    }
  }

  currentCountry = code;
  await window.energysrc.setCountry(code);

  // Destroy and recreate charts with new fuel config
  destroyDemandChart();
  destroyMixChart();

  createDemandChart('demand-chart');
  createMixChart('mix-chart');

  // Switch data source and fetch
  await dataManager.switchCountry(code, apiKey);
  startRefresh();
}

async function main() {
  await initTitlebar();

  // Load saved country preference
  currentCountry = await window.energysrc.getCountry() || 'UK';
  loadAdapter(currentCountry);

  // Init country selector
  const countries = getAvailableCountries();
  initCountrySelector(countries, currentCountry, handleCountryChange);

  // Create charts
  createDemandChart('demand-chart');
  createMixChart('mix-chart');

  // Wire data → charts
  dataManager.onDataChange(onDataChange);

  // If current country needs API key, check we have it
  const adapter = loadAdapter(currentCountry);
  let apiKey = null;
  if (adapter.requiresApiKey) {
    apiKey = await window.energysrc.getApiKey(currentCountry);
    if (!apiKey) {
      apiKey = await showApiKeyPrompt(adapter.name);
      if (apiKey) {
        await window.energysrc.setApiKey(currentCountry, apiKey);
      } else {
        // Fall back to UK
        currentCountry = 'UK';
        loadAdapter('UK');
        setCountrySelector('UK');
        await window.energysrc.setCountry('UK');
        destroyDemandChart();
        destroyMixChart();
        createDemandChart('demand-chart');
        createMixChart('mix-chart');
      }
    }
  }

  // Initialize data with apiKey
  await dataManager.switchCountry(currentCountry, apiKey);
  startRefresh();
}

document.addEventListener('mouseleave', () => {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) tooltip.classList.add('hidden');
});

main().catch(console.error);
