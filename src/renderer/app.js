import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend, zoomPlugin);
Chart.defaults.color = '#888';
Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";

import { initTitlebar } from './titlebar.js';
import { createDemandChart, updateDemandData, destroyDemandChart } from './charts/demandChart.js';
import { createMixChart, updateMixData, destroyMixChart } from './charts/mixChart.js';
import { createCombinedChart, updateCombinedData, destroyCombinedChart } from './charts/combinedChart.js';
import { getAvailableCountries, loadAdapter } from './data/adapters/adapterRegistry.js';
import { initCountrySelector, setCountrySelector } from './ui/countrySelector.js';
import { showApiKeyPrompt } from './ui/apiKeyPrompt.js';
import * as dataManager from './data/dataManager.js';

let currentCountry = 'UK';
let refreshInterval = null;
let combinedMode = false;

function startRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => dataManager.refresh(), 5 * 60 * 1000);
}

function onDataChange(slots) {
  if (combinedMode) {
    updateCombinedData(slots);
  } else {
    updateDemandData(slots);
    updateMixData(slots);
  }
}

function switchView(combined) {
  combinedMode = combined;
  const demandContainer = document.getElementById('demand-container');
  const mixContainer = document.getElementById('mix-container');
  const combinedContainer = document.getElementById('combined-container');

  if (combined) {
    destroyDemandChart();
    destroyMixChart();
    demandContainer.style.display = 'none';
    mixContainer.style.display = 'none';
    combinedContainer.classList.remove('hidden');
    createCombinedChart('combined-chart');
  } else {
    destroyCombinedChart();
    combinedContainer.classList.add('hidden');
    demandContainer.style.display = '';
    mixContainer.style.display = '';
    createDemandChart('demand-chart');
    createMixChart('mix-chart');
  }

  // Re-feed current data to the new charts
  const slots = dataManager.getSlots();
  if (slots.length > 0) onDataChange(slots);
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
  destroyCombinedChart();

  if (combinedMode) {
    createCombinedChart('combined-chart');
  } else {
    createDemandChart('demand-chart');
    createMixChart('mix-chart');
  }

  // Switch data source and fetch
  await dataManager.switchCountry(code, apiKey);
  startRefresh();
}

async function main() {
  await initTitlebar();

  // Load saved country preference (fall back to UK if unknown/corrupt)
  currentCountry = await window.energysrc.getCountry() || 'UK';
  try {
    loadAdapter(currentCountry);
  } catch {
    currentCountry = 'UK';
    loadAdapter('UK');
  }

  // Init country selector
  const countries = getAvailableCountries();
  initCountrySelector(countries, currentCountry, (code) => {
    handleCountryChange(code).catch((e) => {
      console.error('Country switch failed:', e);
      setCountrySelector(currentCountry);
    });
  });

  // Toggle switch
  document.getElementById('view-toggle-input').addEventListener('change', (e) => {
    switchView(e.target.checked);
  });

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
        destroyCombinedChart();
        if (combinedMode) {
          createCombinedChart('combined-chart');
        } else {
          createDemandChart('demand-chart');
          createMixChart('mix-chart');
        }
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
