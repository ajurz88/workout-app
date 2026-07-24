# Workout Tracker

A minimal PWA for logging workouts, tracking progress, and recording body
measurements. Vanilla HTML/CSS/JS, Chart.js for graphs, Supabase for storage,
hosted on GitHub Pages. No login.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`schema.sql`](schema.sql), and run it.
   This creates the `exercises`, `sessions`, `session_sets`, and `body_measurements`
   tables and seeds `exercises` with the starting workout plan (Upper A / Lower A / Upper B / Lower B).
3. Row Level Security is left **off** on purpose — there's no login, so the anon
   key needs open read/write access. Don't put anything sensitive in this project.
4. Go to **Project Settings → API** and copy the **Project URL** and **anon public** key.

## 2. Add your credentials

Edit [`js/config.js`](js/config.js):

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

Until this is filled in, the app shows a banner reminding you to configure it.

## 3. Run it locally

Any static file server works (must be served over HTTP, not `file://`, for
ES modules and the service worker to work):

```powershell
cd workout-tracker
npx serve .
# or: python -m http.server 8080
```

Open the printed local URL in a browser and test the flow.

## 4. Deploy to GitHub Pages

1. Create a new GitHub repo and push this folder to it.
2. In the repo, go to **Settings → Pages**, set source to the `main` branch
   (root), and save.
3. Your app will be live at `https://<username>.github.io/<repo>/`.
4. On iPhone, open that URL in **Safari** → Share → **Add to Home Screen**.
   It installs like a native app (standalone, no browser chrome), using the
   manifest and service worker already wired up in `index.html`.

## App structure

```
index.html            App shell — all 5 views + nav + rest timer overlay
manifest.json          PWA manifest (name, icons, standalone display)
service-worker.js      Caches the app shell for offline/installed use
schema.sql              Supabase table definitions + seed data (workout plan)
css/style.css           All styling — white background, black text
js/config.js            Your Supabase URL + anon key (edit this)
js/supabaseClient.js   Supabase client init
js/db.js                All Supabase queries (exercises, sessions, sets, measurements)
js/timer.js              Rest timer (countdown, beep, vibration)
js/today.js              Today — workout logging
js/history.js            History — past sessions
js/progress.js           Progress — Chart.js line charts per exercise
js/body.js                Body — measurements form + trend charts
js/manage.js              Manage — add/edit/delete exercises
js/app.js                 View router, nav wiring, init
icons/                    App icons (192, 512, apple-touch-icon)
```

## Notes

- **Editing the workout plan**: use the Manage tab, or edit rows directly in
  Supabase's Table Editor. Deleting an exercise doesn't erase past session
  history — logged sets keep a snapshot of the exercise name.
- **Rest timer**: tap the ⏱ button next to any set to start a countdown
  based on that exercise's rest time. It beeps (Web Audio) and vibrates
  (where supported) when done, and is dismissible at any time.
- **Icons**: `icons/*.png` are simple generated placeholders — swap them for
  your own artwork any time (keep the same filenames/sizes: 192×192, 512×512,
  180×180 for `apple-touch-icon.png`).
