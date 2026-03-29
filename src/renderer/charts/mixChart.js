import { Chart } from 'chart.js';
import { getActiveAdapter } from '../data/adapters/adapterRegistry.js';
import { nowLinePlugin, percLabelsPlugin } from './plugins.js';
import { createTooltipHandler } from './tooltip.js';
import { syncDemandScale, setSyncMixChart } from './demandChart.js';
import * as dataManager from '../data/dataManager.js';

let mixChart = null;
let allSlots = [];

function handlePanComplete({ chart }) {
  const { min, max } = chart.scales.x;
  syncDemandScale(min, max);

  const earliest = dataManager.getEarliestLoaded();
  if (earliest) {
    const edgeBuffer = 12 * 60 * 60 * 1000;
    if (min <= earliest.getTime() + edgeBuffer) {
      dataManager.loadMore('left', 7);
    }
  }
}

function getVisibleData(fuel, xMin, xMax) {
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
    const t = s.time.getTime();
    if (t > hi) break;
    if (s.mix && s.mix[fuel] !== undefined) {
      result.push({ x: s.time, y: s.mix[fuel] || 0 });
    }
  }

  if (result.length > 300) {
    return lttbDownsample(result, 300);
  }
  return result;
}

function lttbDownsample(data, threshold) {
  if (data.length <= threshold) return data;
  const sampled = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);
    let avgX = 0, avgY = 0, count = 0;
    const nextStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length - 1);
    for (let j = nextStart; j <= nextEnd && j < data.length; j++) {
      avgX += (data[j].x instanceof Date ? data[j].x.getTime() : data[j].x);
      avgY += data[j].y;
      count++;
    }
    if (count > 0) { avgX /= count; avgY /= count; }
    const ax = data[a].x instanceof Date ? data[a].x.getTime() : data[a].x;
    const ay = data[a].y;
    let maxArea = -1, maxIdx = bucketStart;
    for (let j = bucketStart; j <= bucketEnd && j < data.length; j++) {
      const jx = data[j].x instanceof Date ? data[j].x.getTime() : data[j].x;
      const area = Math.abs((ax - avgX) * (data[j].y - ay) - (ax - jx) * (avgY - ay));
      if (area > maxArea) { maxArea = area; maxIdx = j; }
    }
    sampled.push(data[maxIdx]);
    a = maxIdx;
  }
  sampled.push(data[data.length - 1]);
  return sampled;
}

function refreshVisibleData() {
  if (!mixChart) return;
  const xScale = mixChart.scales.x;
  for (const ds of mixChart.data.datasets) {
    ds.data = getVisibleData(ds.fuel, xScale.min, xScale.max);
  }
  mixChart.update('none');
}

export function createMixChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  const container = canvas.parentElement;
  const adapter = getActiveAdapter();

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const datasets = adapter.stackOrder.map(fuel => ({
    label: adapter.fuelLabels[fuel],
    data: [],
    backgroundColor: adapter.fuelColors[fuel] + '99',
    borderColor: adapter.fuelColors[fuel],
    borderWidth: 0.5,
    fill: 'stack',
    pointRadius: 0,
    pointHitRadius: 8,
    tension: 0.3,
    fuel: fuel
  }));

  mixChart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { left: 0, right: 0, top: 0, bottom: 0 } },
      scales: {
        x: {
          type: 'time',
          min: threeDaysAgo.getTime(),
          max: futureLimit.getTime(),
          time: {
            displayFormats: { hour: 'HH:mm', day: 'EEE dd', week: 'dd MMM', month: 'MMM yy' }
          },
          ticks: { color: '#666', maxRotation: 0, font: { size: 9 }, maxTicksLimit: 8 },
          grid: { color: '#252545' }
        },
        y: {
          stacked: true, min: 0, max: 100,
          ticks: { color: '#666', font: { size: 9 }, callback: v => v + '%', stepSize: 25 },
          grid: { color: '#252545' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: createTooltipHandler(container) },
        zoom: {
          pan: {
            enabled: true, mode: 'x',
            onPanComplete: (ctx) => { handlePanComplete(ctx); refreshVisibleData(); }
          },
          zoom: { wheel: { enabled: false } }
        }
      },
      interaction: { mode: 'index', intersect: false }
    },
    plugins: [nowLinePlugin, percLabelsPlugin]
  });

  mixChart.config._config.percLabelsEnabled = true;

  setSyncMixChart((newMin, newMax) => {
    mixChart.options.scales.x.min = newMin;
    mixChart.options.scales.x.max = newMax;
    mixChart.update('none');
  });

  // Smooth wheel scrolling
  let scrollVelocity = 0;
  let scrolling = false;
  let frameCount = 0;

  function animateScroll() {
    if (Math.abs(scrollVelocity) < 0.0001) {
      scrolling = false;
      refreshVisibleData();
      handlePanComplete({ chart: mixChart });
      return;
    }
    const xScale = mixChart.scales.x;
    const range = xScale.max - xScale.min;
    const shift = range * scrollVelocity;
    const newMin = xScale.min + shift;
    const newMax = xScale.max + shift;
    mixChart.options.scales.x.min = newMin;
    mixChart.options.scales.x.max = newMax;
    frameCount++;
    if (frameCount % 6 === 0) refreshVisibleData();
    else mixChart.update('none');
    syncDemandScale(newMin, newMax);
    scrollVelocity *= 0.85;
    requestAnimationFrame(animateScroll);
  }

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const impulse = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 150) * 0.0003;
    scrollVelocity += impulse;
    scrollVelocity = Math.max(-0.15, Math.min(0.15, scrollVelocity));
    if (!scrolling) { scrolling = true; frameCount = 0; requestAnimationFrame(animateScroll); }
  }, { passive: false });

  return mixChart;
}

export function destroyMixChart() {
  if (mixChart) { mixChart.destroy(); mixChart = null; }
  allSlots = [];
}

export function updateMixData(slots) {
  allSlots = slots;
  refreshVisibleData();
}

export function getMixChart() { return mixChart; }
