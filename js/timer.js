let overlay, timeEl, labelEl, dismissBtn, addBtn;
let intervalId = null;
let remaining = 0;

export function initTimer() {
  overlay = document.getElementById('rest-timer-overlay');
  timeEl = document.getElementById('rest-timer-time');
  labelEl = document.getElementById('rest-timer-label');
  dismissBtn = document.getElementById('rest-timer-dismiss');
  addBtn = document.getElementById('rest-timer-add15');

  dismissBtn.addEventListener('click', stopRestTimer);
  addBtn.addEventListener('click', () => {
    remaining += 15;
    render();
  });
}

export function startRestTimer(seconds, label) {
  if (!seconds || seconds <= 0) return;
  stopRestTimer();
  remaining = seconds;
  labelEl.textContent = label || 'Rest';
  overlay.classList.add('visible');
  render();

  intervalId = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      render();
      onTimerDone();
      return;
    }
    render();
  }, 1000);
}

export function stopRestTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  overlay.classList.remove('visible');
}

function render() {
  const m = Math.floor(Math.max(remaining, 0) / 60);
  const s = Math.max(remaining, 0) % 60;
  timeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function onTimerDone() {
  clearInterval(intervalId);
  intervalId = null;
  labelEl.textContent = 'Rest done';
  playBeep();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    };
    playTone(0);
    playTone(0.5);
  } catch (e) {
    // Web Audio unavailable — silently skip the beep.
  }
}
