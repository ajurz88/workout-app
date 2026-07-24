import { getDistinctExerciseNames, getSessionSetsForExercise } from './db.js';
import { getChartColors } from './theme.js';

const root = () => document.getElementById('view-progress');
let charts = [];

export async function renderProgress() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Progress</h1>
    <div id="progress-charts"><p class="muted">Loading...</p></div>
  `;

  const chartsEl = document.getElementById('progress-charts');
  let names;
  try {
    names = await getDistinctExerciseNames();
  } catch (e) {
    chartsEl.innerHTML = `<p class="error">Could not load exercises: ${e.message}</p>`;
    return;
  }

  if (names.length === 0) {
    chartsEl.innerHTML = '<p class="muted">No logged sets yet.</p>';
    return;
  }

  charts.forEach((c) => c.destroy());
  charts = [];

  chartsEl.innerHTML = names
    .map(
      (name, i) => `
      <h2 class="progress-exercise-title">${name}</h2>
      <div class="chart-card">
        <div class="chart-title">Best Weight (kg)</div>
        <canvas id="weight-chart-${i}"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Total Volume (kg × reps)</div>
        <canvas id="volume-chart-${i}"></canvas>
      </div>`
    )
    .join('');

  await Promise.all(names.map((name, i) => loadExerciseCharts(name, i)));
}

async function loadExerciseCharts(exerciseName, index) {
  let rows;
  try {
    rows = await getSessionSetsForExercise(exerciseName);
  } catch (e) {
    return;
  }
  if (rows.length === 0) return;

  const bySession = {};
  rows.forEach((r) => {
    const date = r.sessions.session_date;
    if (!bySession[date]) bySession[date] = { bestWeight: 0, volume: 0 };
    bySession[date].bestWeight = Math.max(bySession[date].bestWeight, Number(r.weight));
    bySession[date].volume += Number(r.weight) * Number(r.reps);
  });

  const dates = Object.keys(bySession).sort();
  const bestWeights = dates.map((d) => bySession[d].bestWeight);
  const volumes = dates.map((d) => bySession[d].volume);
  const labels = dates.map(formatDate);

  const weightEl = document.getElementById(`weight-chart-${index}`);
  const volumeEl = document.getElementById(`volume-chart-${index}`);
  if (!weightEl || !volumeEl) return;

  charts.push(
    new Chart(weightEl, {
      type: 'line',
      data: { labels, datasets: [chartDataset(bestWeights)] },
      options: chartOptions(bestWeights),
    })
  );

  charts.push(
    new Chart(volumeEl, {
      type: 'line',
      data: { labels, datasets: [chartDataset(volumes)] },
      options: chartOptions(volumes),
    })
  );
}

function chartDataset(data) {
  const colors = getChartColors();
  return {
    data,
    borderColor: colors.line,
    backgroundColor: colors.line,
    pointBackgroundColor: colors.line,
    borderWidth: 2,
    tension: 0.2,
  };
}

// Pad the y-axis to the data's own range instead of always starting at 0,
// so small session-to-session changes are actually visible as movement.
function computeAxisRange(data) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (min === max) {
    const pad = Math.max(min * 0.1, 1);
    return { min: Math.max(0, min - pad), max: max + pad };
  }
  const pad = (max - min) * 0.15;
  return { min: Math.max(0, min - pad), max: max + pad };
}

function chartOptions(data) {
  const colors = getChartColors();
  const range = computeAxisRange(data);
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: colors.tick } },
      y: { grid: { color: colors.grid }, ticks: { color: colors.tick }, min: range.min, max: range.max },
    },
  };
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
