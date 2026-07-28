import { supabase } from './supabaseClient.js';

const DAYS = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];

export { DAYS };

// ---------------------------------------------------------------------------
// exercise pool — exercise definitions, independent of any workout day
// ---------------------------------------------------------------------------
export async function getExercisePool() {
  const { data, error } = await supabase.from('exercises').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addPoolExercise(exercise) {
  const { data, error } = await supabase.from('exercises').insert(exercise).select().single();
  if (error) throw error;
  return data;
}

export async function updatePoolExercise(id, updates) {
  const { data, error } = await supabase.from('exercises').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Removes the exercise from the pool entirely, and (via ON DELETE CASCADE)
// from every workout day it was assigned to. Past session history is
// unaffected — session_sets keeps its own snapshot of the exercise name.
export async function deletePoolExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// workout day composition — which pool exercises belong to which day
// ---------------------------------------------------------------------------
export async function getExercisesForDay(day) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('order_index, exercises(*)')
    .eq('day', day)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data.filter((row) => row.exercises).map((row) => ({ ...row.exercises, order_index: row.order_index }));
}

// Like getExercisesForDay, but keeps the workout_exercises row id so Manage
// can remove a single day-assignment without touching the pool exercise.
export async function getWorkoutAssignmentsForDay(day) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('id, order_index, exercise_id, exercises(*)')
    .eq('day', day)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addExerciseToDay(day, exerciseId) {
  const { data: existing, error: fetchError } = await supabase
    .from('workout_exercises')
    .select('order_index')
    .eq('day', day)
    .order('order_index', { ascending: false })
    .limit(1);
  if (fetchError) throw fetchError;
  const nextOrder = existing.length > 0 ? existing[0].order_index + 1 : 1;
  const { error } = await supabase
    .from('workout_exercises')
    .insert({ day, exercise_id: exerciseId, order_index: nextOrder });
  if (error) throw error;
}

// Removes just this day's assignment (by workout_exercises row id) — the
// pool exercise itself, and other days using it, are untouched.
export async function removeExerciseFromDay(assignmentId) {
  const { error } = await supabase.from('workout_exercises').delete().eq('id', assignmentId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// sessions + session_sets
// ---------------------------------------------------------------------------
export async function saveSession(day, sessionDate, sets, notes) {
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ day, session_date: sessionDate })
    .select()
    .single();
  if (sessionError) throw sessionError;

  const rows = sets.map((s) => ({
    session_id: session.id,
    exercise_id: s.exerciseId,
    exercise_name: s.exerciseName,
    set_number: s.setNumber,
    weight: s.weight,
    reps: s.reps,
  }));

  const { error: setsError } = await supabase.from('session_sets').insert(rows);
  if (setsError) throw setsError;

  if (notes && notes.length > 0) {
    const noteRows = notes.map((n) => ({
      session_id: session.id,
      exercise_id: n.exerciseId,
      exercise_name: n.exerciseName,
      note: n.note,
    }));
    const { error: notesError } = await supabase.from('session_notes').insert(noteRows);
    if (notesError) throw notesError;
  }

  return session;
}

export async function getSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Ordering here is on sessions' own columns (not a joined table), so unlike
// getLastLoggedSets this can safely rely on the server-side order.
export async function getMostRecentSession() {
  const { data, error } = await supabase
    .from('sessions')
    .select('day, session_date')
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data.length > 0 ? data[0] : null;
}

export async function getSessionDetail(sessionId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*, sessions!inner(day)')
    .eq('session_id', sessionId);
  if (error) throw error;
  if (data.length === 0) return data;

  // Order by the exercise's current position in that workout day (not
  // alphabetically). Sets from an exercise no longer on that day's list
  // (removed or deleted since) sort last.
  const day = data[0].sessions.day;
  const { data: assignments, error: assignmentsError } = await supabase
    .from('workout_exercises')
    .select('exercise_id, order_index')
    .eq('day', day);
  if (assignmentsError) throw assignmentsError;

  const orderByExerciseId = {};
  assignments.forEach((a) => {
    orderByExerciseId[a.exercise_id] = a.order_index;
  });

  return data.sort((a, b) => {
    const aOrder = orderByExerciseId[a.exercise_id] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = orderByExerciseId[b.exercise_id] ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.set_number - b.set_number;
  });
}

export async function getSessionSetsForExercise(exerciseName) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*, sessions!inner(session_date, day)')
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// Sets from the most recent session that included this exercise, by the
// session's actual (user-assigned) date — not created_at/insertion time,
// which can differ if a session was logged for a past date or edited later.
// The "most recent" session is found client-side (comparing ISO date
// strings, which sort correctly) rather than via a sort across the joined
// sessions table, which isn't reliably applied through the JS client.
export async function getLastLoggedSets(exerciseName) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('session_id, set_number, weight, reps, sessions!inner(session_date)')
    .eq('exercise_name', exerciseName);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  let latestDate = null;
  let latestSessionId = null;
  data.forEach((r) => {
    const d = r.sessions.session_date;
    if (!latestDate || d > latestDate) {
      latestDate = d;
      latestSessionId = r.session_id;
    }
  });

  const sets = data
    .filter((r) => r.session_id === latestSessionId)
    .sort((a, b) => a.set_number - b.set_number);

  return { date: latestDate, sets };
}

export async function getSessionNotes(sessionId) {
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data;
}

export async function addSessionNote({ sessionId, exerciseId, exerciseName, note }) {
  const { error } = await supabase
    .from('session_notes')
    .insert({ session_id: sessionId, exercise_id: exerciseId, exercise_name: exerciseName, note });
  if (error) throw error;
}

export async function updateSessionNote(id, note) {
  const { error } = await supabase.from('session_notes').update({ note }).eq('id', id);
  if (error) throw error;
}

export async function deleteSessionNote(id) {
  const { error } = await supabase.from('session_notes').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSessionSet(id, updates) {
  const { error } = await supabase.from('session_sets').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteSessionSet(id) {
  const { error } = await supabase.from('session_sets').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

// All logged sets, flattened with their session's date/day, for CSV export.
export async function getAllSessionSetsFlat() {
  const { data, error } = await supabase
    .from('session_sets')
    .select('session_id, exercise_name, set_number, weight, reps, sessions!inner(session_date, day)');
  if (error) throw error;

  // Sort client-side — ordering across the joined sessions table isn't
  // reliably applied through the JS client (see getLastLoggedSets).
  return data.sort((a, b) => {
    if (a.sessions.session_date !== b.sessions.session_date) {
      return a.sessions.session_date < b.sessions.session_date ? -1 : 1;
    }
    if (a.exercise_name !== b.exercise_name) return a.exercise_name < b.exercise_name ? -1 : 1;
    return a.set_number - b.set_number;
  });
}

// All notes, keyed by session_id + exercise_name so they can be matched up
// against getAllSessionSetsFlat() rows for export.
export async function getAllSessionNotesFlat() {
  const { data, error } = await supabase.from('session_notes').select('session_id, exercise_name, note');
  if (error) throw error;
  return data;
}

export async function getDistinctExerciseNames() {
  const { data, error } = await supabase
    .from('session_sets')
    .select('exercise_name')
    .order('exercise_name', { ascending: true });
  if (error) throw error;
  return [...new Set(data.map((r) => r.exercise_name))];
}

// ---------------------------------------------------------------------------
// body_measurements
// ---------------------------------------------------------------------------
export async function addBodyMeasurement(entry) {
  const { data, error } = await supabase.from('body_measurements').insert(entry).select().single();
  if (error) throw error;
  return data;
}

export async function getBodyMeasurements() {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .order('measurement_date', { ascending: true });
  if (error) throw error;
  return data;
}
