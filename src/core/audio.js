// 音：Web Audio で合成。最初の「はじめる」タップで有効化（iOS の制限）。
import { state } from './store.js';

let ctx = null;
let master = null;

export function unlock() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  applyVolume();
  ctx.resume?.();
}

export function applyVolume() { if (master) master.gain.value = state.settings.volume * 0.5; }

function tone(freq, dur, type = 'sine', gain = 0.3, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfx(name) {
  if (name === 'tap') tone(660, 0.1, 'triangle', 0.3);
  else if (name === 'select') tone(520, 0.08, 'triangle', 0.25);
  else if (name === 'move') { tone(140, 0.09, 'square', 0.2); tone(90, 0.12, 'sine', 0.35, 0.01); } // 駒を打つ「パチッ」
  else if (name === 'ok') { tone(523, 0.12, 'triangle', 0.3); tone(784, 0.2, 'triangle', 0.3, 0.1); }
  else if (name === 'clear') { tone(523, 0.12, 'triangle', 0.3); tone(659, 0.12, 'triangle', 0.3, 0.12); tone(784, 0.25, 'triangle', 0.3, 0.24); }
  else if (name === 'no') tone(200, 0.2, 'sawtooth', 0.12);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend?.(); else ctx.resume?.();
});
