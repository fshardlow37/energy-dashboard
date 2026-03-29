import { Chart, LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend, zoomPlugin);

Chart.defaults.color = '#888';
Chart.defaults.font.family = "'Segoe UI', Tahoma, sans-serif";

import { initTitlebar } from './titlebar.js';
import { createDemandChart, updateDemandData } from './charts/demandChart.js';
import { createMixChart, updateMixData } from './charts/mixChart.js';
import * as dataManager from './data/dataManager.js';

async function main() {
  await initTitlebar();

  createDemandChart('demand-chart');
  createMixChart('mix-chart');

  dataManager.onDataChange((slots) => {
    updateDemandData(slots);
    updateMixData(slots);
  });

  await dataManager.initialize();

  // Auto-refresh every 5 minutes
  setInterval(() => dataManager.refresh(), 5 * 60 * 1000);
}

document.addEventListener('mouseleave', () => {
  const tooltip = document.getElementById('tooltip');
  if (tooltip) tooltip.classList.add('hidden');
});

main().catch(console.error);
