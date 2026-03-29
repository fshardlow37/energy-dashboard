import { getActiveAdapter } from '../data/adapters/adapterRegistry.js';

export function createTooltipHandler(containerEl) {
  const tooltipEl = document.getElementById('tooltip');

  return function externalTooltipHandler(context) {
    const { tooltip } = context;

    if (tooltip.opacity === 0) { tooltipEl.classList.add('hidden'); return; }

    const dataPoints = tooltip.dataPoints || [];
    if (dataPoints.length === 0) { tooltipEl.classList.add('hidden'); return; }

    const rawTime = dataPoints[0]?.raw?.x;
    const time = rawTime instanceof Date ? rawTime : new Date(rawTime);
    const timeStr = time.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    }) + ', ' + time.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    });

    let html = `<div class="time">${timeStr}</div>`;

    const adapter = getActiveAdapter();
    const displayOrder = adapter ? adapter.displayOrder : [];
    const fuelColors = adapter ? adapter.fuelColors : {};
    const fuelLabels = adapter ? adapter.fuelLabels : {};

    // Build reverse lookup: label -> fuel key for color
    const labelToFuel = {};
    if (adapter) {
      for (const [key, label] of Object.entries(fuelLabels)) {
        labelToFuel[label] = key;
      }
    }

    const itemMap = {};
    for (const dp of dataPoints) {
      const fuelKey = labelToFuel[dp.dataset.label] || '';
      itemMap[dp.dataset.label] = {
        label: dp.dataset.label,
        value: dp.raw.y,
        color: fuelColors[fuelKey] || '#888'
      };
    }
    const items = displayOrder
      .filter(name => itemMap[name] && itemMap[name].value > 0.05)
      .map(name => itemMap[name]);

    for (const item of items) {
      html += `<div class="row">
        <span class="dot" style="background:${item.color}"></span>
        <span class="label">${item.label}</span>
        <span class="value">${item.value.toFixed(1)}%</span>
      </div>`;
    }

    tooltipEl.innerHTML = html;
    tooltipEl.classList.remove('hidden');

    const containerRect = containerEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let left = tooltip.caretX + 12;
    let top = tooltip.caretY - tooltipRect.height / 2;
    const maxLeft = containerRect.width - tooltipRect.width - 4;
    const maxTop = containerRect.height - tooltipRect.height - 4;
    if (left > maxLeft) left = tooltip.caretX - tooltipRect.width - 12;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    if (top > maxTop) top = maxTop;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = (top + containerRect.top - containerEl.parentElement.getBoundingClientRect().top) + 'px';
  };
}

export function createDemandTooltipHandler(containerEl) {
  const tooltipEl = document.getElementById('tooltip');

  return function externalTooltipHandler(context) {
    const { tooltip } = context;
    if (tooltip.opacity === 0) { tooltipEl.classList.add('hidden'); return; }
    const dataPoints = tooltip.dataPoints || [];
    if (dataPoints.length === 0) { tooltipEl.classList.add('hidden'); return; }

    const rawTime = dataPoints[0]?.raw?.x;
    const time = rawTime instanceof Date ? rawTime : new Date(rawTime);
    const timeStr = time.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    }) + ', ' + time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const demandMW = dataPoints[0]?.raw?.y;
    const demandGW = demandMW ? (demandMW / 1000).toFixed(1) : '?';

    tooltipEl.innerHTML = `
      <div class="time">${timeStr}</div>
      <div class="row"><span class="label">Demand</span><span class="value">${demandGW} GW</span></div>`;
    tooltipEl.classList.remove('hidden');

    const containerRect = containerEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    let left = tooltip.caretX + 12;
    let top = tooltip.caretY - tooltipRect.height / 2;
    const maxLeft = containerRect.width - tooltipRect.width - 4;
    if (left > maxLeft) left = tooltip.caretX - tooltipRect.width - 12;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = (top + containerRect.top - containerEl.parentElement.getBoundingClientRect().top) + 'px';
  };
}
