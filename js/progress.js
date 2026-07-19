import { getDistinctExerciseNames, getSessionSetsForExercise } from './db.js';

const root = () => document.getElementById('view-progress');
let weightChart = null;
let volumeChart = null;

export async function renderProgress() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Progress</h1>
    <select id="exercise-select" class="select-input">
      <option value="">Select an exercise...</option>
    </select>
    <div id="progress-charts"></div>
  `;

  const select = document.getElementById('exercise-select');
  try {
    const names = await getDistinctExerciseNames();
    select.innerHTML +=
      names.map((n) => `<option value="${n}">${n}</option>`).join('');
  } catch (e) {
    document.getElementById('progress-charts').innerHTML = `<p class="error">Could not load exercises: ${e.message}</p>`;
    return;
  }

  select.addEventListener('change', () => {
    if (select.value) loadExerciseProgress(select.value);
    else document.getElementById('progress-charts').innerHTML = '';
  });
}

async function loadExerciseProgress(exerciseName) {
  const chartsEl = document.getElementById('progress-charts');
  chartsEl.innerHTML = `
    <p class="muted">Loading...</p>
  `;

  let rows;
  try {
    rows = await getSessionSetsForExercise(exerciseName);
  } catch (e) {
    chartsEl.innerHTML = `<p class="error">Could not load progress: ${e.message}</p>`;
    return;
  }

  if (rows.length === 0) {
    chartsEl.innerHTML = '<p class="muted">No logged sets for this exercise yet.</p>';
    return;
  }

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

  chartsEl.innerHTML = `
    <div class="chart-card">
      <div class="chart-title">Best Weight (kg)</div>
      <canvas id="weight-chart"></canvas>
    </div>
    <div class="chart-card">
      <div class="chart-title">Total Volume (kg × reps)</div>
      <canvas id="volume-chart"></canvas>
    </div>
  `;

  if (weightChart) weightChart.destroy();
  if (volumeChart) volumeChart.destroy();

  const labels = dates.map(formatDate);

  weightChart = new Chart(document.getElementById('weight-chart'), {
    type: 'line',
    data: { labels, datasets: [chartDataset(bestWeights)] },
    options: chartOptions(),
  });

  volumeChart = new Chart(document.getElementById('volume-chart'), {
    type: 'line',
    data: { labels, datasets: [chartDataset(volumes)] },
    options: chartOptions(),
  });
}

function chartDataset(data) {
  return {
    data,
    borderColor: '#000000',
    backgroundColor: '#000000',
    pointBackgroundColor: '#000000',
    borderWidth: 2,
    tension: 0.2,
  };
}

function chartOptions() {
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#eeeeee' }, beginAtZero: true },
    },
  };
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
