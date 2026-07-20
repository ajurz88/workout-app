import {
  getSessions,
  getSessionDetail,
  getSessionNotes,
  updateSessionSet,
  deleteSessionSet,
  deleteSession,
} from './db.js';

const root = () => document.getElementById('view-history');

let currentSessionId = null;
let currentSets = [];
let editMode = false;

export async function renderHistory() {
  const container = root();
  container.innerHTML = `
    <h1 class="view-title">History</h1>
    <div id="history-list"><p class="muted">Loading...</p></div>
    <div id="session-detail-overlay" class="detail-overlay">
      <div class="detail-sheet">
        <div class="detail-header">
          <span id="session-detail-title"></span>
          <button id="session-detail-close" class="close-btn">✕</button>
        </div>
        <div id="session-detail-actions" class="detail-actions"></div>
        <div id="session-detail-body"></div>
      </div>
    </div>
  `;

  document.getElementById('session-detail-close').addEventListener('click', closeDetail);

  await loadList();
}

async function loadList() {
  const listEl = document.getElementById('history-list');
  listEl.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const sessions = await getSessions();
    if (sessions.length === 0) {
      listEl.innerHTML = '<p class="muted">No sessions logged yet.</p>';
      return;
    }
    listEl.innerHTML = sessions
      .map(
        (s) => `
        <button class="history-row" data-session="${s.id}">
          <span class="history-date">${formatDate(s.session_date)}</span>
          <span class="history-day">${s.day}</span>
        </button>`
      )
      .join('');

    listEl.querySelectorAll('.history-row').forEach((row) => {
      row.addEventListener('click', () => openDetail(row.dataset.session, sessions));
    });
  } catch (e) {
    listEl.innerHTML = `<p class="error">Could not load history: ${e.message}</p>`;
  }
}

async function openDetail(sessionId, sessions) {
  const session = sessions.find((s) => s.id === sessionId);
  currentSessionId = sessionId;
  editMode = false;

  const overlay = document.getElementById('session-detail-overlay');
  const titleEl = document.getElementById('session-detail-title');
  const bodyEl = document.getElementById('session-detail-body');

  titleEl.textContent = `${session.day} · ${formatDate(session.session_date)}`;
  bodyEl.innerHTML = '<p class="muted">Loading...</p>';
  overlay.classList.add('visible');
  renderActions();

  try {
    const [sets, notes] = await Promise.all([
      getSessionDetail(sessionId),
      getSessionNotes(sessionId).catch(() => []),
    ]);
    currentSets = sets;
    renderNotesAndBody(notes);
  } catch (e) {
    bodyEl.innerHTML = `<p class="error">Could not load session: ${e.message}</p>`;
  }
}

let currentNotesByExercise = {};

function renderNotesAndBody(notes) {
  if (notes) {
    currentNotesByExercise = {};
    notes.forEach((n) => {
      currentNotesByExercise[n.exercise_name] = n.note;
    });
  }
  renderBody();
}

function renderActions() {
  const actionsEl = document.getElementById('session-detail-actions');
  if (editMode) {
    actionsEl.innerHTML = `
      <button id="session-detail-save-btn" class="primary-btn">Save Changes</button>
      <button id="session-detail-cancel-btn" class="secondary-btn">Cancel</button>
    `;
    document.getElementById('session-detail-save-btn').addEventListener('click', handleSaveEdits);
    document.getElementById('session-detail-cancel-btn').addEventListener('click', handleCancelEdit);
  } else {
    actionsEl.innerHTML = `
      <button id="session-detail-edit-btn" class="secondary-btn">Edit</button>
      <button id="session-detail-delete-btn" class="danger-btn">Delete Session</button>
    `;
    document.getElementById('session-detail-edit-btn').addEventListener('click', () => {
      editMode = true;
      renderActions();
      renderBody();
    });
    document.getElementById('session-detail-delete-btn').addEventListener('click', handleDeleteSession);
  }
}

function renderBody() {
  const bodyEl = document.getElementById('session-detail-body');

  const grouped = {};
  currentSets.forEach((s) => {
    if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
    grouped[s.exercise_name].push(s);
  });

  bodyEl.innerHTML = Object.entries(grouped)
    .map(([name, rows]) => {
      const setsHtml = editMode
        ? rows
            .map(
              (r) => `
            <div class="edit-set-row" data-id="${r.id}">
              <span>Set ${r.set_number}</span>
              <input type="number" inputmode="decimal" class="edit-weight" value="${r.weight}" />
              <input type="number" inputmode="numeric" class="edit-reps" value="${r.reps}" />
              <button class="edit-delete-set-btn" data-id="${r.id}" title="Delete this set">✕</button>
            </div>`
            )
            .join('')
        : rows
            .map(
              (r) => `<div class="detail-set-row"><span>Set ${r.set_number}</span><span>${r.weight} kg × ${r.reps}</span></div>`
            )
            .join('');

      return `
        <div class="detail-exercise">
          <div class="detail-exercise-name">${name}</div>
          ${setsHtml}
          ${currentNotesByExercise[name] ? `<div class="detail-note">${currentNotesByExercise[name]}</div>` : ''}
        </div>`;
    })
    .join('');

  if (editMode) {
    bodyEl.querySelectorAll('.edit-delete-set-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteSet(btn.dataset.id));
    });
  }
}

async function handleDeleteSet(setId) {
  if (!confirm('Delete this set?')) return;
  try {
    await deleteSessionSet(setId);
    currentSets = currentSets.filter((s) => s.id !== setId);
    renderBody();
  } catch (e) {
    alert(`Could not delete set: ${e.message}`);
  }
}

async function handleSaveEdits() {
  const bodyEl = document.getElementById('session-detail-body');
  const rows = bodyEl.querySelectorAll('.edit-set-row');
  const saveBtn = document.getElementById('session-detail-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await Promise.all(
      Array.from(rows).map((row) => {
        const id = row.dataset.id;
        const weight = parseFloat(row.querySelector('.edit-weight').value);
        const reps = parseInt(row.querySelector('.edit-reps').value, 10);
        return updateSessionSet(id, { weight, reps });
      })
    );
    editMode = false;
    const [sets] = await Promise.all([getSessionDetail(currentSessionId)]);
    currentSets = sets;
    renderActions();
    renderBody();
  } catch (e) {
    alert(`Could not save changes: ${e.message}`);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

async function handleCancelEdit() {
  try {
    currentSets = await getSessionDetail(currentSessionId);
  } catch (e) {
    // keep whatever we already have in memory
  }
  editMode = false;
  renderActions();
  renderBody();
}

async function handleDeleteSession() {
  if (!confirm('Delete this entire session? This cannot be undone.')) return;
  try {
    await deleteSession(currentSessionId);
    closeDetail();
    await loadList();
  } catch (e) {
    alert(`Could not delete session: ${e.message}`);
  }
}

function closeDetail() {
  document.getElementById('session-detail-overlay').classList.remove('visible');
  editMode = false;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
