import { DAYS, getExercisesForDay, getLastLoggedSets, saveSession } from './db.js';
import { startRestTimer } from './timer.js';
import { openExerciseHistory } from './exerciseHistory.js';
import { openGymBarcode } from './gymBarcode.js';

const root = () => document.getElementById('view-today');
const DRAFT_KEY = 'workout-tracker-draft-v1';

let currentDay = null;
let exercises = [];
let lastLogged = {}; // exerciseId -> { date, sets } | null

// Per-day in-memory + persisted state: { logs: {exId: [{weight,reps},...]}, notes: {exId: string}, date }
let dayState = {};

export async function renderToday() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Today</h1>
    <button id="gym-checkin-btn" class="secondary-btn">🎫 Gym Check-In</button>
    <div class="day-picker">
      ${DAYS.map((d) => `<button class="day-btn" data-day="${d}">${d}</button>`).join('')}
    </div>
    <div id="today-log"></div>
  `;

  document.getElementById('gym-checkin-btn').addEventListener('click', openGymBarcode);

  container.querySelectorAll('.day-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectDay(btn.dataset.day));
  });

  if (currentDay) {
    highlightDay(currentDay);
    await selectDay(currentDay);
  }
}

function highlightDay(day) {
  root()
    .querySelectorAll('.day-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.day === day));
}

async function selectDay(day) {
  currentDay = day;
  highlightDay(day);

  const logEl = document.getElementById('today-log');
  logEl.innerHTML = '<p class="muted">Loading...</p>';

  try {
    exercises = await getExercisesForDay(day);
  } catch (e) {
    logEl.innerHTML = `<p class="error">Could not load exercises: ${e.message}</p>`;
    return;
  }

  if (exercises.length === 0) {
    logEl.innerHTML = '<p class="muted">No exercises set up for this day yet. Add some in Manage.</p>';
    return;
  }

  const alreadyInMemory = !!dayState[day];
  const draft = loadDraft()[day];
  const restoredFromDraft = !alreadyInMemory && !!draft;

  if (!dayState[day]) {
    dayState[day] = draft || { logs: {}, notes: {}, date: todayISO() };
  }
  const state = dayState[day];
  if (!state.date) state.date = todayISO();

  exercises.forEach((ex) => {
    if (!state.logs[ex.id]) {
      state.logs[ex.id] = Array.from({ length: ex.target_sets }, () => ({ weight: '', reps: '' }));
    }
    if (state.notes[ex.id] === undefined) state.notes[ex.id] = '';
  });

  lastLogged = {};
  try {
    const results = await Promise.all(
      exercises.map((ex) => getLastLoggedSets(ex.name).catch(() => null))
    );
    exercises.forEach((ex, i) => {
      lastLogged[ex.id] = results[i];
    });
  } catch (e) {
    // Non-fatal — logging still works without "last time" reference data.
  }

  logEl.innerHTML = `
    ${restoredFromDraft ? '<p class="muted draft-restored">Draft restored from earlier.</p>' : ''}
    ${exercises.map(renderExerciseCard).join('')}
    <div class="save-session-bar">
      <input type="date" id="session-date" value="${state.date}" />
      <button id="save-session-btn" class="primary-btn">Save Session</button>
      <button id="clear-draft-btn" class="secondary-btn">Clear Draft</button>
    </div>
  `;

  wireExerciseInputs();
  exercises.forEach((ex) => updateActiveHighlight(ex.id));

  document.getElementById('session-date').addEventListener('change', (e) => {
    state.date = e.target.value;
    persistDraft();
  });
  document.getElementById('save-session-btn').addEventListener('click', handleSave);
  document.getElementById('clear-draft-btn').addEventListener('click', handleClearDraft);
}

function renderExerciseCard(ex) {
  const state = dayState[currentDay];
  const last = lastLogged[ex.id];

  const rows = state.logs[ex.id]
    .map((set, i) => {
      const lastSet = last && last.sets.find((s) => s.set_number === i + 1);
      const lastLabel = lastSet ? `${lastSet.weight}×${lastSet.reps}` : '—';
      return `
      <div class="set-row" data-exercise="${ex.id}" data-set="${i}">
        <span class="set-number">${i + 1}</span>
        <span class="last-set-value">${lastLabel}</span>
        <input type="number" inputmode="decimal" class="weight-input" placeholder="kg" value="${set.weight}" />
        <input type="number" inputmode="numeric" class="reps-input" placeholder="reps" value="${set.reps}" />
        <button class="rest-btn" title="Start rest timer">⏱</button>
      </div>`;
    })
    .join('');

  return `
    <div class="exercise-card">
      <div class="exercise-header">
        <div class="exercise-header-top">
          <span class="exercise-name">${ex.name}</span>
          <button class="history-btn" data-exercise-id="${ex.id}" data-exercise-name="${ex.name}" title="View history">📈 History</button>
        </div>
        <span class="exercise-target">${ex.sets_label} × ${ex.reps_label} · rest ${ex.rest_label}</span>
      </div>
      ${rows}
      <textarea class="exercise-note" data-exercise="${ex.id}" placeholder="Notes (optional)">${state.notes[ex.id]}</textarea>
    </div>
  `;
}

function wireExerciseInputs() {
  const logEl = document.getElementById('today-log');
  const state = dayState[currentDay];

  logEl.querySelectorAll('.set-row').forEach((row) => {
    const exId = row.dataset.exercise;
    const setIdx = Number(row.dataset.set);
    const weightInput = row.querySelector('.weight-input');
    const repsInput = row.querySelector('.reps-input');
    const restBtn = row.querySelector('.rest-btn');

    weightInput.addEventListener('input', () => {
      state.logs[exId][setIdx].weight = weightInput.value;
      persistDraft();
      updateActiveHighlight(exId);
    });
    repsInput.addEventListener('input', () => {
      state.logs[exId][setIdx].reps = repsInput.value;
      persistDraft();
      updateActiveHighlight(exId);
    });
    restBtn.addEventListener('click', () => {
      const ex = exercises.find((e) => e.id === exId);
      startRestTimer(ex.rest_seconds, ex.name);
    });
  });

  logEl.querySelectorAll('.exercise-note').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      state.notes[textarea.dataset.exercise] = textarea.value;
      persistDraft();
    });
  });

  logEl.querySelectorAll('.history-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openExerciseHistory(btn.dataset.exerciseName);
    });
  });
}

function updateActiveHighlight(exId) {
  const logEl = document.getElementById('today-log');
  const rows = logEl.querySelectorAll(`.set-row[data-exercise="${exId}"]`);
  let currentFound = false;
  rows.forEach((row) => {
    const setIdx = Number(row.dataset.set);
    const set = dayState[currentDay].logs[exId][setIdx];
    const complete = set.weight !== '' && set.reps !== '';
    const isCurrent = !complete && !currentFound;
    if (isCurrent) currentFound = true;
    row.classList.toggle('current', isCurrent);
  });
}

async function handleSave() {
  const state = dayState[currentDay];
  const sessionDate = state.date || todayISO();

  const sets = [];
  exercises.forEach((ex) => {
    state.logs[ex.id].forEach((set, i) => {
      const weight = parseFloat(set.weight);
      const reps = parseInt(set.reps, 10);
      if (!Number.isNaN(weight) && !Number.isNaN(reps)) {
        sets.push({ exerciseId: ex.id, exerciseName: ex.name, setNumber: i + 1, weight, reps });
      }
    });
  });

  if (sets.length === 0) {
    alert('Log at least one set before saving.');
    return;
  }

  const notes = exercises
    .filter((ex) => state.notes[ex.id] && state.notes[ex.id].trim() !== '')
    .map((ex) => ({ exerciseId: ex.id, exerciseName: ex.name, note: state.notes[ex.id].trim() }));

  const btn = document.getElementById('save-session-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await saveSession(currentDay, sessionDate, sets, notes);
    delete dayState[currentDay];
    clearDraft(currentDay);
    alert('Session saved.');
    await selectDay(currentDay);
  } catch (e) {
    alert(`Could not save session: ${e.message}`);
    btn.disabled = false;
    btn.textContent = 'Save Session';
  }
}

function handleClearDraft() {
  if (!confirm('Clear all unsaved entries for this day?')) return;
  delete dayState[currentDay];
  clearDraft(currentDay);
  selectDay(currentDay);
}

// ---------------------------------------------------------------------------
// draft persistence (localStorage)
// ---------------------------------------------------------------------------
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function persistDraft() {
  if (!currentDay) return;
  const all = loadDraft();
  all[currentDay] = dayState[currentDay];
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch (e) {
    // Storage unavailable/full — draft just won't persist across reloads.
  }
}

function clearDraft(day) {
  const all = loadDraft();
  delete all[day];
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
  } catch (e) {
    // ignore
  }
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
