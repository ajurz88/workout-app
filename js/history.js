import { getSessions, getSessionDetail, getSessionNotes } from './db.js';

const root = () => document.getElementById('view-history');

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
        <div id="session-detail-body"></div>
      </div>
    </div>
  `;

  document.getElementById('session-detail-close').addEventListener('click', closeDetail);

  const listEl = document.getElementById('history-list');
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
  const overlay = document.getElementById('session-detail-overlay');
  const titleEl = document.getElementById('session-detail-title');
  const bodyEl = document.getElementById('session-detail-body');

  titleEl.textContent = `${session.day} · ${formatDate(session.session_date)}`;
  bodyEl.innerHTML = '<p class="muted">Loading...</p>';
  overlay.classList.add('visible');

  try {
    const [sets, notes] = await Promise.all([
      getSessionDetail(sessionId),
      getSessionNotes(sessionId).catch(() => []),
    ]);
    const grouped = {};
    sets.forEach((s) => {
      if (!grouped[s.exercise_name]) grouped[s.exercise_name] = [];
      grouped[s.exercise_name].push(s);
    });
    const notesByExercise = {};
    notes.forEach((n) => {
      notesByExercise[n.exercise_name] = n.note;
    });

    bodyEl.innerHTML = Object.entries(grouped)
      .map(
        ([name, rows]) => `
        <div class="detail-exercise">
          <div class="detail-exercise-name">${name}</div>
          ${rows
            .map((r) => `<div class="detail-set-row"><span>Set ${r.set_number}</span><span>${r.weight} kg × ${r.reps}</span></div>`)
            .join('')}
          ${notesByExercise[name] ? `<div class="detail-note">${notesByExercise[name]}</div>` : ''}
        </div>`
      )
      .join('');
  } catch (e) {
    bodyEl.innerHTML = `<p class="error">Could not load session: ${e.message}</p>`;
  }
}

function closeDetail() {
  document.getElementById('session-detail-overlay').classList.remove('visible');
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
