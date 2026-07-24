-- Workout Tracker — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- for a FRESH install. If you already have this app set up and are just
-- upgrading to the exercise-pool model, use the incremental migration
-- script instead — don't re-run this whole file against a live database.
--
-- No auth is used, so Row Level Security is disabled on all tables below —
-- anyone with the anon key can read/write. Fine for a single-user personal
-- app used only from your own devices; do not put anything sensitive here.
-- (New Supabase projects auto-enable RLS on tables created via SQL, so the
-- explicit "disable row level security" statements at the bottom of this
-- file are required, not just documentation.)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- exercises: the pool of exercise definitions. Not tied to any workout day —
-- see workout_exercises below for that. Editable from the Manage screen.
-- ---------------------------------------------------------------------------
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  target_sets  int  not null,          -- numeric set count used to render log rows (e.g. 4)
  sets_label   text not null,          -- display label, e.g. "3-4"
  reps_label   text not null,          -- display label, e.g. "4-6" or "10 min"
  rest_seconds int  not null default 0,-- seconds used by the rest timer
  rest_label   text not null,          -- display label, e.g. "2.5-3 min"
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workout_exercises: which pool exercises belong to which workout day, and
-- in what order. A given exercise can be assigned to more than one day.
-- ---------------------------------------------------------------------------
create table if not exists workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  day          text not null,          -- 'Upper A' | 'Lower A' | 'Upper B' | 'Lower B'
  exercise_id  uuid not null references exercises(id) on delete cascade,
  order_index  int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists workout_exercises_day_idx on workout_exercises(day);
create index if not exists workout_exercises_exercise_id_idx on workout_exercises(exercise_id);

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
-- Seed data: the starting workout plan (exercise pool + day assignments)
-- ---------------------------------------------------------------------------
insert into exercises (name, target_sets, sets_label, reps_label, rest_seconds, rest_label) values
('Barbell Bench Press',            4, '4',   '4-6',            180, '2.5-3 min'),
('Weighted Pull-Ups',              4, '4',   '4-6',            180, '2.5-3 min'),
('Overhead Press',                 3, '3',   '5-7',            120, '2 min'),
('Chest-Supported DB Row (wide)',  3, '3',   '6-8',            120, '2 min'),
('Lying Cable EZ Curl',            2, '2',   '8-10',           90,  '60-90 sec'),
('Tricep Pushdown',                2, '2',   '8-10',           90,  '60-90 sec'),
('Hack Squat',                     4, '4',   '4-6',            180, '2.5-3 min'),
('Deadlift',                       4, '3-4', '3-5',            180, '2.5-3 min'),
('Seated Leg Curl',                3, '3',   '8-10',           90,  '75-90 sec'),
('Calf Raises',                    4, '4',   '12-15',          60,  '60 sec'),
('10 Min Ab Circuit',              1, '1',   '10 min',         0,   '-'),
('Incline Press (Smith Machine)',  4, '4',   '8-12',           90,  '75-90 sec'),
('Lat Pulldown (narrow)',          4, '4',   '10-12',          90,  '75-90 sec'),
('Arnold Press',                   3, '3',   '10-12',          75,  '60-75 sec'),
('Cable Row (narrow)',             3, '3',   '12-15',          60,  '60 sec'),
('DB Lateral Raises',              4, '4',   '12-15',          60,  '45-60 sec'),
('Incline Bicep Curl',             3, '3',   '10-12',          60,  '60 sec'),
('Overhead Cable Extension',       3, '3',   '10-12',          60,  '60 sec'),
('Bulgarian Split Squat',          3, '3',   '10-12 each leg', 90,  '75-90 sec'),
('Leg Press',                      3, '3',   '10-15',          90,  '75-90 sec'),
('Romanian Deadlift',              4, '3-4', '8-12',           90,  '90 sec'),
('Hip Thrust Machine',             3, '3',   '10-12',          75,  '60-75 sec'),
('Cable Crunch',                   3, '3',   '12-15',          60,  '45-60 sec');

insert into workout_exercises (day, exercise_id, order_index)
select 'Upper A', id, 1 from exercises where name = 'Barbell Bench Press'
union all select 'Upper A', id, 2 from exercises where name = 'Weighted Pull-Ups'
union all select 'Upper A', id, 3 from exercises where name = 'Overhead Press'
union all select 'Upper A', id, 4 from exercises where name = 'Chest-Supported DB Row (wide)'
union all select 'Upper A', id, 5 from exercises where name = 'Lying Cable EZ Curl'
union all select 'Upper A', id, 6 from exercises where name = 'Tricep Pushdown'
union all select 'Lower A', id, 1 from exercises where name = 'Hack Squat'
union all select 'Lower A', id, 2 from exercises where name = 'Deadlift'
union all select 'Lower A', id, 3 from exercises where name = 'Seated Leg Curl'
union all select 'Lower A', id, 4 from exercises where name = 'Calf Raises'
union all select 'Lower A', id, 5 from exercises where name = '10 Min Ab Circuit'
union all select 'Upper B', id, 1 from exercises where name = 'Incline Press (Smith Machine)'
union all select 'Upper B', id, 2 from exercises where name = 'Lat Pulldown (narrow)'
union all select 'Upper B', id, 3 from exercises where name = 'Arnold Press'
union all select 'Upper B', id, 4 from exercises where name = 'Cable Row (narrow)'
union all select 'Upper B', id, 5 from exercises where name = 'DB Lateral Raises'
union all select 'Upper B', id, 6 from exercises where name = 'Incline Bicep Curl'
union all select 'Upper B', id, 7 from exercises where name = 'Overhead Cable Extension'
union all select 'Lower B', id, 1 from exercises where name = 'Bulgarian Split Squat'
union all select 'Lower B', id, 2 from exercises where name = 'Leg Press'
union all select 'Lower B', id, 3 from exercises where name = 'Romanian Deadlift'
union all select 'Lower B', id, 4 from exercises where name = 'Hip Thrust Machine'
union all select 'Lower B', id, 5 from exercises where name = 'Cable Crunch';

-- ---------------------------------------------------------------------------
-- Disable RLS explicitly. Supabase auto-enables it on tables created via the
-- SQL editor; with no policies defined that silently blocks all anon-key
-- access. Since this app has no auth, disable it outright instead.
-- ---------------------------------------------------------------------------
alter table exercises disable row level security;
alter table workout_exercises disable row level security;
alter table sessions disable row level security;
alter table session_sets disable row level security;
alter table session_notes disable row level security;
alter table body_measurements disable row level security;
