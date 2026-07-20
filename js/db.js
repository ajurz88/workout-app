import { supabase } from './supabaseClient.js';

const DAYS = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];

export { DAYS };

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------
export async function getExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('day', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getExercisesForDay(day) {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('day', day)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addExercise(exercise) {
  const { data, error } = await supabase.from('exercises').insert(exercise).select().single();
  if (error) throw error;
  return data;
}

export async function updateExercise(id, updates) {
  const { data, error } = await supabase
    .from('exercises')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
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

export async function getSessionDetail(sessionId) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('exercise_name', { ascending: true })
    .order('set_number', { ascending: true });
  if (error) throw error;
  return data;
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

// Sets from the most recent session that included this exercise. Relies on
// all sets of one exercise in one session sharing a created_at batch, so the
// newest rows (limited) all belong to that latest session.
export async function getLastLoggedSets(exerciseName) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('session_id, set_number, weight, reps, sessions!inner(session_date)')
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const lastSessionId = data[0].session_id;
  const sets = data
    .filter((r) => r.session_id === lastSessionId)
    .sort((a, b) => a.set_number - b.set_number);

  return { date: data[0].sessions.session_date, sets };
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
