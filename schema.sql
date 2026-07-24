-- Workout Tracker — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- No auth is used, so Row Level Security is disabled on all tables below —
-- anyone with the anon key can read/write. Fine for a single-user personal
-- app used only from your own devices; do not put anything sensitive here.
-- (New Supabase projects auto-enable RLS on tables created via SQL, so the
-- explicit "disable row level security" statements at the bottom of this
-- file are required, not just documentation.)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- exercises: the workout plan. Editable from the Manage screen.
-- ---------------------------------------------------------------------------
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  day          text not null,          -- 'Upper A' | 'Lower A' | 'Upper B' | 'Lower B'
  name         text not null,
  target_sets  int  not null,          -- numeric set count used to render log rows (e.g. 4)
  sets_label   text not null,          -- display label, e.g. "3-4"
  reps_label   text not null,          -- display label, e.g. "4-6" or "10 min"
  rest_seconds int  not null default 0,-- seconds used by the rest timer
  rest_label   text not null,          -- display label, e.g. "2.5-3 min"
  order_index  int  not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sessions: one row per logged workout
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  day           text not null,
  session_date  date not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- session_sets: individual set logs within a session
-- ---------------------------------------------------------------------------
create table if not exists session_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  exercise_id   uuid references exercises(id) on delete set null,
  exercise_name text not null,   -- snapshot so history stays intact if exercise is renamed/deleted
  set_number    int  not null,
  weight        numeric not null,
  reps          int  not null,
  created_at    timestamptz not null default now()
);

create index if not exists session_sets_session_id_idx on session_sets(session_id);
create index if not exists session_sets_exercise_name_idx on session_sets(exercise_name);

-- ---------------------------------------------------------------------------
-- session_notes: one optional freeform note per exercise per session
-- ---------------------------------------------------------------------------
create table if not exists session_notes (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  exercise_id   uuid references exercises(id) on delete set null,
  exercise_name text not null,
  note          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists session_notes_session_id_idx on session_notes(session_id);

-- ---------------------------------------------------------------------------
-- body_measurements: weekly measurements
-- ---------------------------------------------------------------------------
create table if not exists body_measurements (
  id                uuid primary key default gen_random_uuid(),
  measurement_date  date not null,
  weight_kg         numeric,
  waist_cm          numeric,
  chest_cm          numeric,
  arm_cm            numeric,
  thigh_cm          numeric,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seed data: the starting workout plan
-- ---------------------------------------------------------------------------
insert into exercises (day, name, target_sets, sets_label, reps_label, rest_seconds, rest_label, order_index) values
-- Upper A — Strength
('Upper A', 'Barbell Bench Press',        4, '4',   '4-6',            180, '2.5-3 min', 1),
('Upper A', 'Weighted Pull-Ups',          4, '4',   '4-6',            180, '2.5-3 min', 2),
('Upper A', 'Overhead Press',             3, '3',   '5-7',            120, '2 min',     3),
('Upper A', 'Chest-Supported DB Row (wide)', 3, '3', '6-8',           120, '2 min',     4),
('Upper A', 'Lying Cable EZ Curl',        2, '2',   '8-10',           90,  '60-90 sec', 5),
('Upper A', 'Tricep Pushdown',            2, '2',   '8-10',           90,  '60-90 sec', 6),

-- Lower A — Strength
('Lower A', 'Hack Squat',                 4, '4',   '4-6',            180, '2.5-3 min', 1),
('Lower A', 'Deadlift',                   4, '3-4', '3-5',            180, '2.5-3 min', 2),
('Lower A', 'Seated Leg Curl',            3, '3',   '8-10',           90,  '75-90 sec', 3),
('Lower A', 'Calf Raises',                4, '4',   '12-15',          60,  '60 sec',    4),
('Lower A', '10 Min Ab Circuit',          1, '1',   '10 min',         0,   '-',         5),

-- Upper B — Hypertrophy
('Upper B', 'Incline Press (Smith Machine)', 4, '4', '8-12',          90,  '75-90 sec', 1),
('Upper B', 'Lat Pulldown (narrow)',      4, '4',   '10-12',          90,  '75-90 sec', 2),
('Upper B', 'Arnold Press',               3, '3',   '10-12',          75,  '60-75 sec', 3),
('Upper B', 'Cable Row (narrow)',         3, '3',   '12-15',          60,  '60 sec',    4),
('Upper B', 'DB Lateral Raises',          4, '4',   '12-15',          60,  '45-60 sec', 5),
('Upper B', 'Incline Bicep Curl',         3, '3',   '10-12',          60,  '60 sec',    6),
('Upper B', 'Overhead Cable Extension',   3, '3',   '10-12',          60,  '60 sec',    7),

-- Lower B — Hypertrophy
('Lower B', 'Bulgarian Split Squat',      3, '3',   '10-12 each leg', 90,  '75-90 sec', 1),
('Lower B', 'Leg Press',                  3, '3',   '10-15',          90,  '75-90 sec', 2),
('Lower B', 'Romanian Deadlift',          4, '3-4', '8-12',           90,  '90 sec',    3),
('Lower B', 'Hip Thrust Machine',         3, '3',   '10-12',          75,  '60-75 sec', 4),
('Lower B', 'Cable Crunch',               3, '3',   '12-15',          60,  '45-60 sec', 5);

-- ---------------------------------------------------------------------------
-- Disable RLS explicitly. Supabase auto-enables it on tables created via the
-- SQL editor; with no policies defined that silently blocks all anon-key
-- access. Since this app has no auth, disable it outright instead.
-- ---------------------------------------------------------------------------
alter table exercises disable row level security;
alter table sessions disable row level security;
alter table session_sets disable row level security;
alter table session_notes disable row level security;
alter table body_measurements disable row level security;
