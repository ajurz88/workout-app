const THEME_KEY = 'workout-tracker-theme';

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function isDarkMode() {
  return getTheme() === 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
}

export function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    line: read('--text', '#000000'),
    grid: read('--border-light', '#eeeeee'),
    tick: read('--muted', '#777777'),
  };
}

export function toggleTheme() {
  const next = isDarkMode() ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    // Storage unavailable — theme choice just won't persist across reloads.
  }
  return next;
}
