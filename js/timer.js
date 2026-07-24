let overlay, timeEl, labelEl, dismissBtn, addBtn;
let intervalId = null;
let remaining = 0;
let audioCtx = null;

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

  // iOS only allows audio to play if the AudioContext was created/resumed
  // directly inside a user-gesture handler (this tap). Doing that here means
  // the beep at timeout — which fires from a setInterval, not a gesture —
  // is actually allowed to play.
  unlockAudio();

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
  overlay.classList.remove('flash');
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
  flashOverlay();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
}

function flashOverlay() {
  overlay.classList.remove('flash');
  // Force a reflow so re-adding the class restarts the animation even if
  // the timer is started again quickly after the last flash.
  void overlay.offsetWidth;
  overlay.classList.add('flash');
}

function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Play an inaudible blip immediately, inside this tap's gesture. Calling
    // resume() alone doesn't reliably unlock playback on every iOS version —
    // actually starting a sound (even silent) is the more reliable unlock.
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // Web Audio unavailable — the beep just won't play.
  }
}

function playBeep() {
  if (!audioCtx) return;
  try {
    const playTone = (delay) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.4);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + 0.4);
    };
    playTone(0);
    playTone(0.5);
  } catch (e) {
    // Web Audio unavailable — silently skip the beep.
  }
}
