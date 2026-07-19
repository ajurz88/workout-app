import { DAYS, getExercises, addExercise, updateExercise, deleteExercise } from './db.js';

const root = () => document.getElementById('view-manage');
let exercises = [];
let editingId = null;

export async function renderManage() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">Manage</h1>
    <button id="add-exercise-btn" class="primary-btn">+ Add Exercise</button>
    <div id="manage-list"><p class="muted">Loading...</p></div>
    <div id="exercise-form-overlay" class="detail-overlay">
      <div class="detail-sheet">
        <div class="detail-header">
          <span id="exercise-form-title">Add Exercise</span>
          <button id="exercise-form-close" class="close-btn">✕</button>
        </div>
        <form id="exercise-form" class="measurement-form">
          <label>Name<input type="text" id="ex-name" required /></label>
          <label>Day
            <select id="ex-day" required>
              ${DAYS.map((d) => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </label>
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
  `;

  document.getElementById('add-exercise-btn').addEventListener('click', () => openForm());
  document.getElementById('exercise-form-close').addEventListener('click', closeForm);
  document.getElementById('exercise-form').addEventListener('submit', handleSubmit);
  document.getElementById('exercise-delete-btn').addEventListener('click', handleDelete);

  await loadList();
}

async function loadList() {
  const listEl = document.getElementById('manage-list');
  try {
    exercises = await getExercises();
  } catch (e) {
    listEl.innerHTML = `<p class="error">Could not load exercises: ${e.message}</p>`;
    return;
  }

  listEl.innerHTML = DAYS.map((day) => {
    const dayExercises = exercises.filter((e) => e.day === day);
    return `
      <div class="manage-day-group">
        <div class="manage-day-title">${day}</div>
        ${
          dayExercises.length === 0
            ? '<p class="muted">No exercises yet.</p>'
            : dayExercises
                .map(
                  (ex) => `
              <button class="manage-row" data-id="${ex.id}">
                <span class="manage-row-name">${ex.name}</span>
                <span class="manage-row-detail">${ex.sets_label} × ${ex.reps_label} · rest ${ex.rest_label}</span>
              </button>`
                )
                .join('')
        }
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.manage-row').forEach((row) => {
    row.addEventListener('click', () => openForm(row.dataset.id));
  });
}

function openForm(id) {
  editingId = id || null;
  const overlay = document.getElementById('exercise-form-overlay');
  const title = document.getElementById('exercise-form-title');
  const deleteBtn = document.getElementById('exercise-delete-btn');

  if (editingId) {
    const ex = exercises.find((e) => e.id === editingId);
    title.textContent = 'Edit Exercise';
    document.getElementById('ex-name').value = ex.name;
    document.getElementById('ex-day').value = ex.day;
    document.getElementById('ex-target-sets').value = ex.target_sets;
    document.getElementById('ex-sets-label').value = ex.sets_label;
    document.getElementById('ex-reps-label').value = ex.reps_label;
    document.getElementById('ex-rest-seconds').value = ex.rest_seconds;
    document.getElementById('ex-rest-label').value = ex.rest_label;
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'Add Exercise';
    document.getElementById('exercise-form').reset();
    deleteBtn.style.display = 'none';
  }

  overlay.classList.add('visible');
}

function closeForm() {
  document.getElementById('exercise-form-overlay').classList.remove('visible');
  editingId = null;
}

async function handleSubmit(evt) {
  evt.preventDefault();
  const payload = {
    name: document.getElementById('ex-name').value.trim(),
    day: document.getElementById('ex-day').value,
    target_sets: parseInt(document.getElementById('ex-target-sets').value, 10),
    sets_label: document.getElementById('ex-sets-label').value.trim(),
    reps_label: document.getElementById('ex-reps-label').value.trim(),
    rest_seconds: parseInt(document.getElementById('ex-rest-seconds').value, 10),
    rest_label: document.getElementById('ex-rest-label').value.trim(),
  };

  try {
    if (editingId) {
      await updateExercise(editingId, payload);
    } else {
      const dayCount = exercises.filter((e) => e.day === payload.day).length;
      await addExercise({ ...payload, order_index: dayCount + 1 });
    }
    closeForm();
    await loadList();
  } catch (e) {
    alert(`Could not save exercise: ${e.message}`);
  }
}

async function handleDelete() {
  if (!editingId) return;
  if (!confirm('Delete this exercise? Past session history will keep its logged data.')) return;

  try {
    await deleteExercise(editingId);
    closeForm();
    await loadList();
  } catch (e) {
    alert(`Could not delete exercise: ${e.message}`);
  }
}
