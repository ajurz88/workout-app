import { isConfigured } from './supabaseClient.js';
import { initTimer } from './timer.js';
import { initExerciseHistory } from './exerciseHistory.js';
import { renderToday } from './today.js';
import { renderHistory } from './history.js';
import { renderProgress } from './progress.js';
import { renderBody } from './body.js';
import { renderManage } from './manage.js';

const VIEWS = {
  today: renderToday,
  history: renderHistory,
  progress: renderProgress,
  body: renderBody,
  manage: renderManage,
};

let currentView = 'today';

function showConfigWarningIfNeeded() {
  if (isConfigured) return;
  const banner = document.getElementById('config-warning');
  banner.classList.add('visible');
}

async function switchView(view) {
  if (!VIEWS[view]) return;
  currentView = view;

  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  await VIEWS[view]();
}

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

async function init() {
  initTimer();
  initExerciseHistory();
  initNav();
  showConfigWarningIfNeeded();
  registerServiceWorker();
  await switchView(currentView);
}

init();
