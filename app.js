'use strict';

const CIRCUMFERENCE = 2 * Math.PI * 95; // ≈ 596.9

// Inject SVG gradient
document.querySelectorAll('.ring').forEach(svg => {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c6aff"/>
      <stop offset="100%" stop-color="#00d4ff"/>
    </linearGradient>`;
  svg.prepend(defs);
});

// ── Tab switching ──────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
  });
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function pad(n, digits = 2) {
  return String(Math.floor(n)).padStart(digits, '0');
}

function setRingOffset(ringEl, ratio) {
  // ratio 0 → full ring, ratio 1 → empty ring
  const offset = CIRCUMFERENCE * Math.max(0, Math.min(1, ratio));
  ringEl.style.strokeDashoffset = offset;
  ringEl.style.strokeDasharray = CIRCUMFERENCE;
}

// ── TIMER ──────────────────────────────────────────────────────────────────────
const timerDisplay = document.getElementById('timer-display');
const timerRing    = document.getElementById('timer-ring');

let timerTotal    = 0;
let timerRemain   = 0;
let timerInterval = null;
let timerRunning  = false;

function timerFormat(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${pad(m)}:${pad(s)}`;
}

function timerUpdateUI() {
  timerDisplay.textContent = timerFormat(timerRemain);
  const ratio = timerTotal > 0 ? 1 - timerRemain / timerTotal : 1;
  setRingOffset(timerRing, ratio);
}

function timerStart() {
  if (timerRemain <= 0 || timerRunning) return;
  timerRunning = true;
  document.getElementById('timer-start').textContent = '一時停止';
  timerRing.classList.add('pulsing');

  timerInterval = setInterval(() => {
    timerRemain--;
    timerUpdateUI();
    if (timerRemain <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerRing.classList.remove('pulsing');
      document.getElementById('timer-start').textContent = 'スタート';
      showAlarm();
    }
  }, 1000);
}

function timerPause() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerRing.classList.remove('pulsing');
  document.getElementById('timer-start').textContent = 'スタート';
}

function timerSetSeconds(sec) {
  timerPause();
  timerTotal  = sec;
  timerRemain = sec;
  timerUpdateUI();
  highlightPreset(sec);
}

function highlightPreset(sec) {
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.seconds) === sec);
  });
}

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => timerSetSeconds(Number(btn.dataset.seconds)));
});

// Manual set
document.getElementById('timer-set').addEventListener('click', () => {
  const m = parseInt(document.getElementById('timer-input-min').value) || 0;
  const s = parseInt(document.getElementById('timer-input-sec').value) || 0;
  const total = m * 60 + s;
  if (total > 0) timerSetSeconds(total);
});

// Start / Pause
document.getElementById('timer-start').addEventListener('click', () => {
  if (timerRunning) timerPause(); else timerStart();
});

// Reset
document.getElementById('timer-reset').addEventListener('click', () => {
  timerSetSeconds(timerTotal);
});

// Init
timerSetSeconds(0);
setRingOffset(timerRing, 1);

// ── ALARM ──────────────────────────────────────────────────────────────────────
const alarmOverlay = document.getElementById('alarm-overlay');

function showAlarm() {
  alarmOverlay.classList.remove('hidden');
  try {
    const ctx = new AudioContext();
    [0, 250, 500].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay / 1000);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay / 1000 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay / 1000 + 0.2);
      osc.start(ctx.currentTime + delay / 1000);
      osc.stop(ctx.currentTime + delay / 1000 + 0.25);
    });
  } catch (_) { /* AudioContext not available */ }
}

document.getElementById('alarm-dismiss').addEventListener('click', () => {
  alarmOverlay.classList.add('hidden');
  timerSetSeconds(timerTotal);
});

// ── STOPWATCH ──────────────────────────────────────────────────────────────────
const swDisplay   = document.getElementById('sw-display');
const swRing      = document.getElementById('sw-ring');
const lapList     = document.getElementById('lap-list');

let swStart     = 0;
let swElapsed   = 0;
let swSplit     = 0;
let swInterval  = null;
let swRunning   = false;
let lapCount    = 0;

const LAP_RING_CYCLE = 60000; // ring completes every 60 s

function swFormat(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m    = Math.floor(totalSec / 60);
  const s    = totalSec % 60;
  const mill = Math.floor((ms % 1000));
  return `${pad(m)}:${pad(s)}<span class="millis">.${pad(mill, 3)}</span>`;
}

function swUpdateUI() {
  const now = swRunning ? swElapsed + (Date.now() - swStart) : swElapsed;
  swDisplay.innerHTML = swFormat(now);
  const ratio = (now % LAP_RING_CYCLE) / LAP_RING_CYCLE;
  setRingOffset(swRing, ratio);
}

function swStartFn() {
  swRunning = true;
  swStart   = Date.now();
  document.getElementById('sw-start').textContent = '停止';
  swRing.classList.add('pulsing');
  swInterval = setInterval(swUpdateUI, 30);
}

function swStopFn() {
  swElapsed += Date.now() - swStart;
  clearInterval(swInterval);
  swRunning = false;
  swRing.classList.remove('pulsing');
  document.getElementById('sw-start').textContent = 'スタート';
  swUpdateUI();
}

document.getElementById('sw-start').addEventListener('click', () => {
  if (swRunning) swStopFn(); else swStartFn();
});

document.getElementById('sw-lap').addEventListener('click', () => {
  if (!swRunning && swElapsed === 0) return;
  const now  = swRunning ? swElapsed + (Date.now() - swStart) : swElapsed;
  const split = now - swSplit;
  swSplit = now;
  lapCount++;

  const li = document.createElement('li');
  li.innerHTML = `<span class="lap-num">Lap ${lapCount}</span>
                  <span class="lap-time">${formatLapTime(split)}</span>
                  <span class="lap-time">${formatLapTime(now)}</span>`;
  lapList.prepend(li);
});

document.getElementById('sw-reset').addEventListener('click', () => {
  swStopFn();
  swElapsed  = 0;
  swSplit    = 0;
  lapCount   = 0;
  lapList.innerHTML = '';
  swDisplay.innerHTML = `00:00<span class="millis">.000</span>`;
  setRingOffset(swRing, 1);
  document.getElementById('sw-start').textContent = 'スタート';
});

function formatLapTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m    = Math.floor(totalSec / 60);
  const s    = totalSec % 60;
  const mill = Math.floor(ms % 1000);
  return `${pad(m)}:${pad(s)}.${pad(mill, 3)}`;
}

// Init ring
setRingOffset(swRing, 1);
