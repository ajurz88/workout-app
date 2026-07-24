import { getSessionSetsForExercise } from './db.js';

export function initExerciseHistory() {
  document.getElementById('exercise-history-close').addEventListener('click', closeExerciseHistory);
}

export async function openExerciseHistory(exerciseName) {
  const overlay = document.getElementById('exercise-history-overlay');
  const titleEl = document.getElementById('exercise-history-title');
  const bodyEl = document.getElementById('exercise-history-body');

  titleEl.textContent = exerciseName;
  bodyEl.innerHTML = '<p class="muted">Loading...</p>';
  overlay.classList.add('visible');

  try {
    const rows = await getSessionSetsForExercise(exerciseName);
    if (rows.length === 0) {
      bodyEl.innerHTML = '<p class="muted">No past sessions logged for this exercise yet.</p>';
      return;
    }

    const bySession = {};
    rows.forEach((r) => {
      const date = r.sessions.session_date;
      if (!bySession[date]) bySession[date] = [];
      bySession[date].push(r);
    });

    const dates = Object.keys(bySession).sort().reverse();

    bodyEl.innerHTML = dates
      .map((date) => {
        const sets = bySession[date].sort((a, b) => a.set_number - b.set_number);
        const best = Math.max(...sets.map((s) => Number(s.weight)));
        return `
          <div class="exercise-history-session">
            <div class="exercise-history-date">${formatDate(date)} <span class="muted">· best ${best} kg</span></div>
            <div class="exercise-history-sets">${sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</div>
          </div>`;
      })
      .join('');
  } catch (e) {
    bodyEl.innerHTML = `<p class="error">Could not load history: ${e.message}</p>`;
  }
}

function closeExerciseHistory() {
  document.getElementById('exercise-history-overlay').classList.remove('visible');
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
