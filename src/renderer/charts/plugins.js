// Custom Chart.js plugins: "Now" line and percentage labels

export const nowLinePlugin = {
  id: 'nowLine',
  afterDraw(chart) {
    const xScale = chart.scales.x;
    if (!xScale) return;

    const now = Date.now();
    if (now < xScale.min || now > xScale.max) return;

    const xPixel = xScale.getPixelForValue(now);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.moveTo(xPixel, top);
    ctx.lineTo(xPixel, bottom);
    ctx.stroke();
    ctx.restore();
  }
};

export const percLabelsPlugin = {
  id: 'percLabels',
  afterDraw(chart) {
    if (!chart.config._config.percLabelsEnabled) return;

    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return;

    const now = Date.now();
    if (now < xScale.min || now > xScale.max) return;

    const xPixel = xScale.getPixelForValue(now);
    const ctx = chart.ctx;
    const datasets = chart.data.datasets;

    // Find data point closest to now
    let closestIdx = -1;
    let closestDist = Infinity;
    if (datasets.length > 0 && datasets[0].data.length > 0) {
      for (let i = 0; i < datasets[0].data.length; i++) {
        const pt = datasets[0].data[i];
        const t = pt.x instanceof Date ? pt.x.getTime() : pt.x;
        const dist = Math.abs(t - now);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
    }

    if (closestIdx === -1) return;

    ctx.save();
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'right';

    const textColors = {
      'Wind':    '#000000',
    };

    let cumulative = 0;
    for (let di = 0; di < datasets.length; di++) {
      const ds = datasets[di];
      const val = ds.data[closestIdx]?.y ?? 0;
      if (val < 1.5) { cumulative += val; continue; }

      const midPerc = cumulative + val / 2;
      const yPixel = yScale.getPixelForValue(midPerc);

      const text = `${ds.label} ${Math.round(val)}%`;
      const isWind = ds.label === 'Wind';
      ctx.strokeStyle = isWind ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(text, xPixel - 5, yPixel + 3);
      ctx.fillStyle = isWind ? '#000000' : '#ffffff';
      ctx.fillText(text, xPixel - 5, yPixel + 3);

      cumulative += val;
    }

    ctx.restore();
  }
};
