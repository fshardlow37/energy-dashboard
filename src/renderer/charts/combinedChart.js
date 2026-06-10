import { Chart } from 'chart.js';
import { getActiveAdapter } from '../data/adapters/adapterRegistry.js';
import { nowLinePlugin } from './plugins.js';
import { createCombinedTooltipHandler } from './tooltip.js';
import * as dataManager from '../data/dataManager.js';

let combinedChart = null;
let allSlots = [];
let removeWheelListener = null;

function handlePanComplete({ chart }) {
  const earliest = dataManager.getEarliestLoaded();
  if (earliest) {
    const edgeBuffer = 12 * 60 * 60 * 1000;
    if (chart.scales.x.min <= earliest.getTime() + edgeBuffer) {
      dataManager.loadMore('left', 7);
    }
  }
}

function lttbDownsample(data, threshold) {
  if (data.length <= threshold) return data;
  const sampled = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length - 1);
    const nextStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextEnd = Math.min(Math.floor((i + 3) * bucketSize) + 1, data.length - 1);
    let avgX = 0, avgY = 0, count = 0;
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

function getVisibleGW(fuel, xMin, xMax) {
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
    if (s.mix && s.mix[fuel] !== undefined && s.demandMW > 0) {
      const gw = (s.mix[fuel] / 100) * (s.demandMW / 1000);
      result.push({ x: s.time, y: gw });
    }
  }

  if (result.length > 300) return lttbDownsample(result, 300);
  return result;
}

function refreshVisibleData() {
  if (!combinedChart) return;
  const xScale = combinedChart.scales.x;
  for (const ds of combinedChart.data.datasets) {
    ds.data = getVisibleGW(ds.fuel, xScale.min, xScale.max);
  }
  combinedChart.update('none');
}

export function createCombinedChart(canvasId) {
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

  combinedChart = new Chart(canvas, {
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
          grid: { color: '#21262d' }
        },
        y: {
          stacked: true, min: 0,
          ticks: {
            color: '#666',
            font: { size: 9 },
            callback: v => v.toFixed(0) + ' GW',
            maxTicksLimit: 6
          },
          grid: { color: '#21262d' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: createCombinedTooltipHandler(container) },
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
    plugins: [nowLinePlugin, gwLabelsPlugin]
  });

  // Smooth wheel scrolling
  let scrollVelocity = 0;
  let scrolling = false;
  let frameCount = 0;

  function animateScroll() {
    if (!combinedChart) { scrolling = false; return; }
    if (Math.abs(scrollVelocity) < 0.0001) {
      scrolling = false;
      refreshVisibleData();
      handlePanComplete({ chart: combinedChart });
      return;
    }
    const xScale = combinedChart.scales.x;
    const range = xScale.max - xScale.min;
    const shift = range * scrollVelocity;
    const newMin = xScale.min + shift;
    const newMax = xScale.max + shift;
    combinedChart.options.scales.x.min = newMin;
    combinedChart.options.scales.x.max = newMax;
    frameCount++;
    if (frameCount % 6 === 0) refreshVisibleData();
    else combinedChart.update('none');
    scrollVelocity *= 0.85;
    requestAnimationFrame(animateScroll);
  }

  const onWheel = (e) => {
    e.preventDefault();
    const impulse = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 150) * 0.0003;
    scrollVelocity += impulse;
    scrollVelocity = Math.max(-0.15, Math.min(0.15, scrollVelocity));
    if (!scrolling) { scrolling = true; frameCount = 0; requestAnimationFrame(animateScroll); }
  };
  // Remove any listener left over from a previous chart instance (container persists in the DOM)
  if (removeWheelListener) removeWheelListener();
  container.addEventListener('wheel', onWheel, { passive: false });
  removeWheelListener = () => container.removeEventListener('wheel', onWheel);

  return combinedChart;
}

export function destroyCombinedChart() {
  if (removeWheelListener) { removeWheelListener(); removeWheelListener = null; }
  if (combinedChart) { combinedChart.destroy(); combinedChart = null; }
  allSlots = [];
}

export function updateCombinedData(slots) {
  allSlots = slots;
  refreshVisibleData();
}

// Plugin: labels at the "now" line showing GW per fuel
const gwLabelsPlugin = {
  id: 'gwLabels',
  afterDraw(chart) {
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return;
    const now = Date.now();
    if (now < xScale.min || now > xScale.max) return;

    const xPixel = xScale.getPixelForValue(now);
    const ctx = chart.ctx;
    const datasets = chart.data.datasets;

    let closestIdx = -1;
    let closestDist = Infinity;
    if (datasets.length > 0 && datasets[0].data.length > 0) {
      for (let i = 0; i < datasets[0].data.length; i++) {
        const pt = datasets[0].data[i];
        const t = pt.x instanceof Date ? pt.x.getTime() : pt.x;
        const dist = Math.abs(t - now);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      }
    }
    if (closestIdx === -1) return;

    const adapter = getActiveAdapter();
    const darkLabels = adapter?.darkTextLabels || [];

    ctx.save();
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'right';

    let cumulative = 0;
    for (let di = 0; di < datasets.length; di++) {
      const ds = datasets[di];
      const val = ds.data[closestIdx]?.y ?? 0;
      if (val < 0.05) { cumulative += val; continue; }

      const midGW = cumulative + val / 2;
      const yPixel = yScale.getPixelForValue(midGW);

      const text = `${ds.label} ${val.toFixed(1)} GW`;
      const isDark = darkLabels.includes(ds.label);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, xPixel - 5, yPixel + 3);
      ctx.fillStyle = isDark ? '#000000' : '#ffffff';
      ctx.fillText(text, xPixel - 5, yPixel + 3);

      cumulative += val;
    }
    ctx.restore();
  }
};
