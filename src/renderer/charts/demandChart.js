import { Chart } from 'chart.js';
import { nowLinePlugin } from './plugins.js';
import { createDemandTooltipHandler } from './tooltip.js';
import * as dataManager from '../data/dataManager.js';

let demandChart = null;
let allSlots = [];
let _syncMixChart = null;
export function setSyncMixChart(fn) { _syncMixChart = fn; }

function getVisibleDemand(xMin, xMax) {
  const buffer = (xMax - xMin) * 0.2;
  const lo = xMin - buffer;
  const hi = xMax + buffer;

  let left = 0, right = allSlots.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (allSlots[mid].time.getTime() < lo) left = mid + 1;
    else right = mid;
  }

  const result = [];
  for (let i = left; i < allSlots.length; i++) {
    const s = allSlots[i];
    if (s.time.getTime() > hi) break;
    if (s.demandMW !== null && s.demandMW > 0) {
      result.push({ x: s.time, y: s.demandMW });
    }
  }
  return result;
}

function refreshVisibleDemand() {
  if (!demandChart) return;
  const xScale = demandChart.scales.x;
  demandChart.data.datasets[0].data = getVisibleDemand(xScale.min, xScale.max);
  demandChart.update('none');
}

export function createDemandChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  const container = canvas.parentElement;

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  demandChart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Demand',
        data: [],
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 8,
        tension: 0.3,
        fill: false,
        segment: {
          borderColor: (ctx) => {
            const val = ctx.p1.parsed.y;
            const meta = demandChart?._weeklyStats;
            if (!meta) return '#FFC107';
            if (val >= meta.max * 0.85) return '#F44336';
            if (val <= meta.min * 1.15) return '#4CAF50';
            return '#FFC107';
          }
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { left: 0, right: 0, top: 2, bottom: 0 } },
      scales: {
        x: {
          type: 'time',
          min: threeDaysAgo.getTime(),
          max: futureLimit.getTime(),
          time: {
            displayFormats: {
              hour: 'HH:mm',
              day: 'EEE dd',
              week: 'dd MMM',
              month: 'MMM yy'
            }
          },
          ticks: { color: '#666', maxRotation: 0, font: { size: 9 }, maxTicksLimit: 6 },
          grid: { color: '#252545' }
        },
        y: {
          ticks: {
            color: '#666',
            font: { size: 9 },
            callback: v => (v / 1000).toFixed(0) + 'GW',
            maxTicksLimit: 4
          },
          grid: { color: '#252545' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: createDemandTooltipHandler(container)
        },
        zoom: {
          pan: { enabled: false },
          zoom: { wheel: { enabled: false } }
        }
      },
      interaction: { mode: 'index', intersect: false }
    },
    plugins: [nowLinePlugin]
  });

  // Smooth wheel scrolling
  let scrollVelocity = 0;
  let scrolling = false;
  let frameCount = 0;

  function animateScroll() {
    if (Math.abs(scrollVelocity) < 0.0001) {
      scrolling = false;
      refreshVisibleDemand();
      const earliest = dataManager.getEarliestLoaded();
      if (earliest && demandChart.scales.x.min <= earliest.getTime() + 12 * 60 * 60 * 1000) {
        dataManager.loadMore('left', 7);
      }
      return;
    }
    const xScale = demandChart.scales.x;
    const range = xScale.max - xScale.min;
    const shift = range * scrollVelocity;
    const newMin = xScale.min + shift;
    const newMax = xScale.max + shift;
    demandChart.options.scales.x.min = newMin;
    demandChart.options.scales.x.max = newMax;

    frameCount++;
    if (frameCount % 6 === 0) {
      refreshVisibleDemand();
    } else {
      demandChart.update('none');
    }

    if (_syncMixChart) _syncMixChart(newMin, newMax);
    scrollVelocity *= 0.85;
    requestAnimationFrame(animateScroll);
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const impulse = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 150) * 0.0003;
    scrollVelocity += impulse;
    scrollVelocity = Math.max(-0.15, Math.min(0.15, scrollVelocity));
    if (!scrolling) {
      scrolling = true;
      frameCount = 0;
      requestAnimationFrame(animateScroll);
    }
  }, { passive: false });

  return demandChart;
}

export function updateDemandData(slots) {
  allSlots = slots;

  // Compute weekly stats from all data (not just visible)
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekValues = [];
  for (const s of slots) {
    if (s.demandMW > 0) {
      const t = s.time instanceof Date ? s.time.getTime() : s.time;
      if (t >= weekAgo) weekValues.push(s.demandMW);
    }
  }
  if (weekValues.length > 0) {
    demandChart._weeklyStats = {
      min: Math.min(...weekValues),
      max: Math.max(...weekValues),
      avg: weekValues.reduce((a, b) => a + b, 0) / weekValues.length
    };
  }

  refreshVisibleDemand();
}

export function syncDemandScale(xMin, xMax) {
  if (!demandChart) return;
  demandChart.options.scales.x.min = xMin;
  demandChart.options.scales.x.max = xMax;
  refreshVisibleDemand();
}

export function destroyDemandChart() {
  if (demandChart) { demandChart.destroy(); demandChart = null; }
  allSlots = [];
}

export function getDemandChart() { return demandChart; }
