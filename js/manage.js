import {
  DAYS,
  getExercisePool,
  addPoolExercise,
  updatePoolExercise,
  deletePoolExercise,
  getWorkoutAssignmentsForDay,
  addExerciseToDay,
  removeExerciseFromDay,
} from './db.js';
import { exportAllData } from './export.js';
import { isDarkMode, toggleTheme } from './theme.js';

const root = () => document.getElementById('view-manage');
let pool = [];
let assignments = {}; // day -> [{ id, order_index, exercise_id, exercises }]
let editingPoolId = null;
let pickerDay = null;

export async function renderManage() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Manage</h1>

    <h2 class="manage-section-title">Exercise Pool</h2>
    <p class="muted manage-section-hint">All exercises you can add to any workout day.</p>
    <button id="add-pool-exercise-btn" class="primary-btn">+ New Exercise</button>
    <div id="pool-list"><p class="muted">Loading...</p></div>

    <div id="day-sections"></div>

    <div class="manage-settings">
      <button id="export-data-btn" class="secondary-btn">Export Data (CSV)</button>
      <button id="dark-mode-btn" class="secondary-btn">${isDarkMode() ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
    </div>

    <div id="exercise-form-overlay" class="detail-overlay">
      <div class="detail-sheet">
        <div class="detail-header">
          <span id="exercise-form-title">Add Exercise</span>
          <button id="exercise-form-close" class="close-btn">✕</button>
        </div>
        <form id="exercise-form" class="measurement-form">
          <label>Name<input type="text" id="ex-name" required /></label>
          <label>Target Sets (number of log rows)<input type="number" id="ex-target-sets" min="1" required /></label>
          <label>Sets Label (e.g. "3-4")<input type="text" id="ex-sets-label" required /></label>
          <label>Reps Label (e.g. "8-12" or "10 min")<input type="text" id="ex-reps-label" required /></label>
          <label>Rest (seconds, used by timer)<input type="number" id="ex-rest-seconds" min="0" required /></label>
          <label>Rest Label (e.g. "60-90 sec")<input type="text" id="ex-rest-label" required /></label>
          <div class="form-actions">
            <button type="submit" class="primary-btn">Save</button>
            <button type="button" id="exercise-delete-btn" class="danger-btn" style="display:none">Delete</button>
          </div>
        </form>
      </div>
    </div>

    <div id="exercise-picker-overlay" class="detail-overlay">
      <div class="detail-sheet">
        <div class="detail-header">
          <span id="exercise-picker-title">Add Exercise</span>
          <button id="exercise-picker-close" class="close-btn">✕</button>
        </div>
        <div id="exercise-picker-list"></div>
      </div>
    </div>
  `;

  document.getElementById('add-pool-exercise-btn').addEventListener('click', () => openForm());
  document.getElementById('exercise-form-close').addEventListener('click', closeForm);
  document.getElementById('exercise-form').addEventListener('submit', handleSubmit);
  document.getElementById('exercise-delete-btn').addEventListener('click', handleDelete);
  document.getElementById('exercise-picker-close').addEventListener('click', closePicker);
  document.getElementById('export-data-btn').addEventListener('click', handleExport);
  document.getElementById('dark-mode-btn').addEventListener('click', handleToggleDarkMode);

  await loadAll();
}

async function loadAll() {
  const poolListEl = document.getElementById('pool-list');
  try {
    const [poolData, ...assignmentResults] = await Promise.all([
      getExercisePool(),
      ...DAYS.map((day) => getWorkoutAssignmentsForDay(day)),
    ]);
    pool = poolData;
    assignments = {};
    DAYS.forEach((day, i) => {
      assignments[day] = assignmentResults[i];
    });
  } catch (e) {
    poolListEl.innerHTML = `<p class="error">Could not load exercises: ${e.message}</p>`;
    return;
  }

  renderPoolList();
  renderDaySections();
}

function renderPoolList() {
  const poolListEl = document.getElementById('pool-list');
  if (pool.length === 0) {
    poolListEl.innerHTML = '<p class="muted">No exercises yet. Add one above.</p>';
    return;
  }
  poolListEl.innerHTML = pool
    .map(
      (ex) => `
    <button class="manage-row" data-id="${ex.id}">
      <span class="manage-row-name">${ex.name}</span>
      <span class="manage-row-detail">${ex.sets_label} × ${ex.reps_label} · rest ${ex.rest_label}</span>
    </button>`
    )
    .join('');

  poolListEl.querySelectorAll('.manage-row').forEach((row) => {
    row.addEventListener('click', () => openForm(row.dataset.id));
  });
}

function renderDaySections() {
  const sectionsEl = document.getElementById('day-sections');
  sectionsEl.innerHTML = DAYS.map(
    (day) => `
    <div class="manage-day-group">
      <div class="manage-day-title">${day}</div>
      <div class="manage-day-exercises" data-day="${day}">
        ${
          assignments[day].length === 0
            ? '<p class="muted">No exercises assigned yet.</p>'
            : assignments[day]
                .map(
                  (a) => `
              <div class="manage-assigned-row">
                <div>
                  <span class="manage-row-name">${a.exercises.name}</span>
                  <span class="manage-row-detail">${a.exercises.sets_label} × ${a.exercises.reps_label} · rest ${a.exercises.rest_label}</span>
                </div>
                <button class="remove-assignment-btn" data-assignment-id="${a.id}" title="Remove from ${day}">✕</button>
              </div>`
                )
                .join('')
        }
      </div>
      <button class="secondary-btn add-to-day-btn" data-day="${day}">+ Add Exercise to ${day}</button>
    </div>
  `
  ).join('');

  sectionsEl.querySelectorAll('.add-to-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => openPicker(btn.dataset.day));
  });
  sectionsEl.querySelectorAll('.remove-assignment-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleRemoveFromDay(btn.dataset.assignmentId));
  });
}

function openForm(id) {
  editingPoolId = id || null;
  const overlay = document.getElementById('exercise-form-overlay');
  const title = document.getElementById('exercise-form-title');
  const deleteBtn = document.getElementById('exercise-delete-btn');

  if (editingPoolId) {
    const ex = pool.find((e) => e.id === editingPoolId);
    title.textContent = 'Edit Exercise';
    document.getElementById('ex-name').value = ex.name;
    document.getElementById('ex-target-sets').value = ex.target_sets;
    document.getElementById('ex-sets-label').value = ex.sets_label;
    document.getElementById('ex-reps-label').value = ex.reps_label;
    document.getElementById('ex-rest-seconds').value = ex.rest_seconds;
    document.getElementById('ex-rest-label').value = ex.rest_label;
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'New Exercise';
    document.getElementById('exercise-form').reset();
    deleteBtn.style.display = 'none';
  }

  overlay.classList.add('visible');
}

function closeForm() {
  document.getElementById('exercise-form-overlay').classList.remove('visible');
  editingPoolId = null;
}

async function handleSubmit(evt) {
  evt.preventDefault();
  const payload = {
    name: document.getElementById('ex-name').value.trim(),
    target_sets: parseInt(document.getElementById('ex-target-sets').value, 10),
    sets_label: document.getElementById('ex-sets-label').value.trim(),
    reps_label: document.getElementById('ex-reps-label').value.trim(),
    rest_seconds: parseInt(document.getElementById('ex-rest-seconds').value, 10),
    rest_label: document.getElementById('ex-rest-label').value.trim(),
  };

  try {
    if (editingPoolId) {
      await updatePoolExercise(editingPoolId, payload);
    } else {
      await addPoolExercise(payload);
    }
    closeForm();
    await loadAll();
  } catch (e) {
    alert(`Could not save exercise: ${e.message}`);
  }
}

async function handleDelete() {
  if (!editingPoolId) return;
  if (
    !confirm(
      'Delete this exercise from the pool? It will be removed from every workout day using it. Past session history keeps its own record and is not affected.'
    )
  )
    return;

  try {
    await deletePoolExercise(editingPoolId);
    closeForm();
    await loadAll();
  } catch (e) {
    alert(`Could not delete exercise: ${e.message}`);
  }
}

function openPicker(day) {
  pickerDay = day;
  const overlay = document.getElementById('exercise-picker-overlay');
  const title = document.getElementById('exercise-picker-title');
  const listEl = document.getElementById('exercise-picker-list');

  title.textContent = `Add Exercise to ${day}`;

  const assignedIds = new Set(assignments[day].map((a) => a.exercise_id));
  const available = pool.filter((ex) => !assignedIds.has(ex.id));

  listEl.innerHTML =
    available.length === 0
      ? '<p class="muted">All exercises in your pool are already on this day. Add a new exercise first.</p>'
      : available
          .map(
            (ex) => `
        <button class="manage-row" data-id="${ex.id}">
          <span class="manage-row-name">${ex.name}</span>
          <span class="manage-row-detail">${ex.sets_label} × ${ex.reps_label} · rest ${ex.rest_label}</span>
        </button>`
          )
          .join('');

  listEl.querySelectorAll('.manage-row').forEach((row) => {
    row.addEventListener('click', () => handlePickExercise(row.dataset.id));
  });

  overlay.classList.add('visible');
}

function closePicker() {
  document.getElementById('exercise-picker-overlay').classList.remove('visible');
  pickerDay = null;
}

async function handlePickExercise(exerciseId) {
  if (!pickerDay) return;
  try {
    await addExerciseToDay(pickerDay, exerciseId);
    closePicker();
    await loadAll();
  } catch (e) {
    alert(`Could not add exercise: ${e.message}`);
  }
}

async function handleRemoveFromDay(assignmentId) {
  if (!confirm('Remove this exercise from this day? It stays in your exercise pool.')) return;
  try {
    await removeExerciseFromDay(assignmentId);
    await loadAll();
  } catch (e) {
    alert(`Could not remove exercise: ${e.message}`);
  }
}

async function handleExport() {
  const btn = document.getElementById('export-data-btn');
  btn.disabled = true;
  btn.textContent = 'Exporting...';
  try {
    await exportAllData();
  } catch (e) {
    alert(`Could not export data: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export Data (CSV)';
  }
}

function handleToggleDarkMode() {
  toggleTheme();
  document.getElementById('dark-mode-btn').textContent = isDarkMode() ? '☀️ Light Mode' : '🌙 Dark Mode';
}
