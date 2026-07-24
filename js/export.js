import { getAllSessionSetsFlat, getAllSessionNotesFlat, getBodyMeasurements } from './db.js';

export async function exportAllData() {
  const [sets, notes, measurements] = await Promise.all([
    getAllSessionSetsFlat(),
    getAllSessionNotesFlat(),
    getBodyMeasurements(),
  ]);

  const notesByKey = {};
  notes.forEach((n) => {
    notesByKey[`${n.session_id}__${n.exercise_name}`] = n.note;
  });

  const workoutRows = sets.map((s) => [
    s.sessions.session_date,
    s.sessions.day,
    s.exercise_name,
    s.set_number,
    s.weight,
    s.reps,
    notesByKey[`${s.session_id}__${s.exercise_name}`] || '',
  ]);
  downloadCsv(
    'workout_history.csv',
    toCsv(['date', 'day', 'exercise', 'set_number', 'weight_kg', 'reps', 'note'], workoutRows)
  );

  const measurementRows = measurements.map((m) => [
    m.measurement_date,
    m.weight_kg ?? '',
    m.waist_cm ?? '',
    m.chest_cm ?? '',
    m.arm_cm ?? '',
    m.thigh_cm ?? '',
  ]);
  downloadCsv(
    'body_measurements.csv',
    toCsv(['date', 'weight_kg', 'waist_cm', 'chest_cm', 'arm_cm', 'thigh_cm'], measurementRows)
  );
}

function toCsv(headers, rows) {
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach((row) => lines.push(row.map(escape).join(',')));
  return lines.join('\r\n');
}

function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
