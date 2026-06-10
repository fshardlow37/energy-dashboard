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

    const adapter = getActiveAdapter();
    const displayOrder = adapter ? adapter.displayOrder : [];
    const fuelColors = adapter ? adapter.fuelColors : {};
    const fuelLabels = adapter ? adapter.fuelLabels : {};

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

    while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    timeDiv.textContent = timeStr;
    tooltipEl.appendChild(timeDiv);

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      row.appendChild(dot);
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.label;
      row.appendChild(label);
      const val = document.createElement('span');
      val.className = 'value';
      val.textContent = item.value.toFixed(1) + '%';
      row.appendChild(val);
      tooltipEl.appendChild(row);
    }
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

export function createCombinedTooltipHandler(containerEl) {
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

    const adapter = getActiveAdapter();
    const displayOrder = adapter ? adapter.displayOrder : [];
    const fuelColors = adapter ? adapter.fuelColors : {};
    const fuelLabels = adapter ? adapter.fuelLabels : {};

    const labelToFuel = {};
    if (adapter) {
      for (const [key, label] of Object.entries(fuelLabels)) {
        labelToFuel[label] = key;
      }
    }

    const itemMap = {};
    let totalGW = 0;
    for (const dp of dataPoints) {
      const fuelKey = labelToFuel[dp.dataset.label] || '';
      const gw = dp.raw.y || 0;
      totalGW += gw;
      itemMap[dp.dataset.label] = {
        label: dp.dataset.label,
        value: gw,
        color: fuelColors[fuelKey] || '#888'
      };
    }
    const items = displayOrder
      .filter(name => itemMap[name] && itemMap[name].value > 0.01)
      .map(name => itemMap[name]);

    while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    timeDiv.textContent = timeStr;
    tooltipEl.appendChild(timeDiv);

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = item.color;
      row.appendChild(dot);
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.label;
      row.appendChild(label);
      const val = document.createElement('span');
      val.className = 'value';
      val.textContent = item.value.toFixed(1) + ' GW';
      row.appendChild(val);
      tooltipEl.appendChild(row);
    }

    const demandRow = document.createElement('div');
    demandRow.className = 'row demand-row';
    const demandLabel = document.createElement('span');
    demandLabel.className = 'label';
    demandLabel.textContent = 'Total';
    demandRow.appendChild(demandLabel);
    const demandVal = document.createElement('span');
    demandVal.className = 'value';
    demandVal.textContent = totalGW.toFixed(1) + ' GW';
    demandRow.appendChild(demandVal);
    tooltipEl.appendChild(demandRow);

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

    while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);
    const timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    timeDiv.textContent = timeStr;
    tooltipEl.appendChild(timeDiv);
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Demand';
    row.appendChild(label);
    const val = document.createElement('span');
    val.className = 'value';
    val.textContent = demandGW + ' GW';
    row.appendChild(val);
    tooltipEl.appendChild(row);
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
