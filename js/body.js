import { addBodyMeasurement, getBodyMeasurements } from './db.js';

const root = () => document.getElementById('view-body');

const METRICS = [
  { key: 'weight_kg', label: 'Weight (kg)' },
  { key: 'waist_cm', label: 'Waist (cm)' },
  { key: 'chest_cm', label: 'Chest (cm)' },
  { key: 'arm_cm', label: 'Upper Arm Flexed (cm)' },
  { key: 'thigh_cm', label: 'Thigh (cm)' },
];

let charts = {};

export async function renderBody() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Body</h1>
    <div id="latest-measurement"></div>
    <form id="measurement-form" class="measurement-form">
      <label>Date<input type="date" id="m-date" value="${todayISO()}" required /></label>
      <label>Weight (kg)<input type="number" step="0.1" inputmode="decimal" id="m-weight" /></label>
      <label>Waist (cm)<input type="number" step="0.1" inputmode="decimal" id="m-waist" /></label>
      <label>Chest (cm)<input type="number" step="0.1" inputmode="decimal" id="m-chest" /></label>
      <label>Upper Arm Flexed (cm)<input type="number" step="0.1" inputmode="decimal" id="m-arm" /></label>
      <label>Thigh (cm)<input type="number" step="0.1" inputmode="decimal" id="m-thigh" /></label>
      <button type="submit" class="primary-btn">Save Measurement</button>
    </form>
    <div id="measurement-charts"></div>
  `;

  document.getElementById('measurement-form').addEventListener('submit', handleSubmit);
  await loadData();
}

async function handleSubmit(evt) {
  evt.preventDefault();
  const entry = {
    measurement_date: document.getElementById('m-date').value,
    weight_kg: parseFloatOrNull('m-weight'),
    waist_cm: parseFloatOrNull('m-waist'),
    chest_cm: parseFloatOrNull('m-chest'),
    arm_cm: parseFloatOrNull('m-arm'),
    thigh_cm: parseFloatOrNull('m-thigh'),
  };

  const btn = evt.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await addBodyMeasurement(entry);
    evt.target.reset();
    document.getElementById('m-date').value = todayISO();
    await loadData();
  } catch (e) {
    alert(`Could not save measurement: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Measurement';
  }
}

function parseFloatOrNull(id) {
  const v = document.getElementById(id).value;
  return v === '' ? null : parseFloat(v);
}

async function loadData() {
  const latestEl = document.getElementById('latest-measurement');
  const chartsEl = document.getElementById('measurement-charts');

  let rows;
  try {
    rows = await getBodyMeasurements();
  } catch (e) {
    latestEl.innerHTML = `<p class="error">Could not load measurements: ${e.message}</p>`;
    return;
  }

  if (rows.length === 0) {
    latestEl.innerHTML = '<p class="muted">No measurements logged yet.</p>';
    chartsEl.innerHTML = '';
    return;
  }

  const latest = rows[rows.length - 1];
  latestEl.innerHTML = `
    <div class="latest-card">
      <div class="latest-date">${formatDate(latest.measurement_date)}</div>
      <div class="latest-grid">
        ${METRICS.map(
          (m) => `<div class="latest-metric"><span>${m.label}</span><strong>${latest[m.key] ?? '-'}</strong></div>`
        ).join('')}
      </div>
    </div>
  `;

  chartsEl.innerHTML = METRICS.map(
    (m) => `
    <div class="chart-card">
      <div class="chart-title">${m.label}</div>
      <canvas id="chart-${m.key}"></canvas>
    </div>`
  ).join('');

  const labels = rows.map((r) => formatDate(r.measurement_date));

  METRICS.forEach((m) => {
    if (charts[m.key]) charts[m.key].destroy();
    const data = rows.map((r) => r[m.key]);
    charts[m.key] = new Chart(document.getElementById(`chart-${m.key}`), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data,
            borderColor: '#000000',
            backgroundColor: '#000000',
            pointBackgroundColor: '#000000',
            borderWidth: 2,
            tension: 0.2,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: '#eeeeee' } },
        },
      },
    });
  });
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
