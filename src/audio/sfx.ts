import Phaser from 'phaser';
import { MIN_GAP_MS, SOUNDS, type SoundKey } from '../data/sounds';

// Recordings dropped into src/sounds/ (e.g. quack.mp3) are found at build time.
const recordingFiles = import.meta.glob('../sounds/*.{mp3,m4a,ogg,wav}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Recording URLs by sound, for sounds that have one. */
export function recordingUrls(): Partial<Record<SoundKey, string>> {
  const urls: Partial<Record<SoundKey, string>> = {};
  for (const [path, url] of Object.entries(recordingFiles)) {
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
    if (name in SOUNDS) urls[name as SoundKey] = url;
  }
  return urls;
}

export const recordingKey = (sound: SoundKey) => `sfx-${sound}`;

// --- Mute setting (remembered between visits) --------------------------------

const MUTE_KEY = 'duckdefense.muted';
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(scene: Phaser.Scene, value: boolean): void {
  muted = value;
  scene.sound.mute = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked (private browsing); the setting just won't be remembered.
  }
}

// --- Playing sounds ------------------------------------------------------------

const lastPlayed = new Map<SoundKey, number>();

export function playSound(scene: Phaser.Scene, sound: SoundKey): void {
  if (muted) return;
  const now = performance.now();
  const gap = MIN_GAP_MS[sound] ?? 0;
  if (now - (lastPlayed.get(sound) ?? -Infinity) < gap) return;
  lastPlayed.set(sound, now);

  const { volume } = SOUNDS[sound];
  if (scene.cache.audio.exists(recordingKey(sound))) {
    scene.sound.play(recordingKey(sound), { volume });
    return;
  }
  const context = 'context' in scene.sound ? (scene.sound as Phaser.Sound.WebAudioSoundManager).context : undefined;
  if (context && context.state === 'running') PLACEHOLDERS[sound](context, volume);
}

// --- Built-in placeholder sounds, made by the browser -------------------------

type Wave = OscillatorType;

function tone(
  ctx: AudioContext,
  options: { type: Wave; from: number; to?: number; start?: number; duration: number; volume: number; vibrato?: number },
): void {
  const t = ctx.currentTime + (options.start ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type;
  osc.frequency.setValueAtTime(options.from, t);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, t + options.duration);
  if (options.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 7;
    depth.gain.value = options.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + options.duration);
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(options.volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + options.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + options.duration + 0.02);
}

let noiseBuffer: AudioBuffer | undefined;

function noise(
  ctx: AudioContext,
  options: { filter: BiquadFilterType; from: number; to?: number; start?: number; duration: number; volume: number },
): void {
  if (!noiseBuffer || noiseBuffer.sampleRate !== ctx.sampleRate) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + (options.start ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = options.filter;
  filter.frequency.setValueAtTime(options.from, t);
  if (options.to) filter.frequency.exponentialRampToValueAtTime(options.to, t + options.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(options.volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + options.duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(t);
  source.stop(t + options.duration + 0.02);
}

/** A cartoon quack: a buzzy tone through a nasal filter, dropping in pitch. */
function quack(ctx: AudioContext, start: number, volume: number): void {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(560, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.18);
  filter.type = 'bandpass';
  filter.frequency.value = 1300;
  filter.Q.value = 4;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}

function notes(ctx: AudioContext, type: Wave, freqs: number[], step: number, volume: number, last = step): void {
  freqs.forEach((f, i) => tone(ctx, { type, from: f, start: i * step, duration: i === freqs.length - 1 ? last : step * 1.1, volume }));
}

const PLACEHOLDERS: Record<SoundKey, (ctx: AudioContext, volume: number) => void> = {
  splash: (ctx, v) => {
    noise(ctx, { filter: 'bandpass', from: 1800, to: 500, duration: 0.18, volume: 0.35 * v });
    tone(ctx, { type: 'sine', from: 900, to: 300, duration: 0.08, volume: 0.12 * v });
  },
  peck: (ctx, v) => tone(ctx, { type: 'square', from: 1100, to: 700, duration: 0.04, volume: 0.1 * v }),
  flap: (ctx, v) => {
    for (let i = 0; i < 3; i++) noise(ctx, { filter: 'highpass', from: 1500, start: i * 0.06, duration: 0.05, volume: 0.25 * v });
  },
  quack: (ctx, v) => quack(ctx, 0, 0.35 * v),
  nope: (ctx, v) => {
    tone(ctx, { type: 'triangle', from: 220, to: 200, duration: 0.12, volume: 0.25 * v });
    tone(ctx, { type: 'triangle', from: 180, to: 150, start: 0.14, duration: 0.2, volume: 0.25 * v });
  },
  eek: (ctx, v) => {
    tone(ctx, { type: 'square', from: 900, to: 1700, duration: 0.12, volume: 0.07 * v });
    tone(ctx, { type: 'square', from: 1100, to: 1900, start: 0.1, duration: 0.1, volume: 0.06 * v });
  },
  chasedOff: (ctx, v) => {
    tone(ctx, { type: 'sine', from: 500, to: 1400, duration: 0.14, volume: 0.15 * v });
    noise(ctx, { filter: 'lowpass', from: 900, duration: 0.2, volume: 0.15 * v });
  },
  pea: (ctx, v) => notes(ctx, 'sine', [1320, 1760], 0.06, 0.12 * v),
  heartLost: (ctx, v) =>
    notes(ctx, 'triangle', [392, 370, 349], 0.14, 0.22 * v, 0.3),
  shoo: (ctx, v) => {
    tone(ctx, { type: 'sine', from: 700, to: 1800, duration: 0.2, volume: 0.15 * v });
    notes(ctx, 'sine', [2093, 2637], 0.05, 0.06 * v);
  },
  place: (ctx, v) => tone(ctx, { type: 'sine', from: 280, to: 560, duration: 0.12, volume: 0.3 * v }),
  sell: (ctx, v) => {
    tone(ctx, { type: 'sine', from: 560, to: 280, duration: 0.14, volume: 0.25 * v });
    notes(ctx, 'sine', [1320, 1760], 0.06, 0.1 * v);
  },
  upgrade: (ctx, v) => {
    notes(ctx, 'triangle', [523, 784, 1047], 0.07, 0.18 * v, 0.25);
    tone(ctx, { type: 'sine', from: 1568, to: 2093, start: 0.2, duration: 0.25, volume: 0.08 * v });
  },
  move: (ctx, v) => {
    tone(ctx, { type: 'sine', from: 300, to: 700, duration: 0.18, volume: 0.2 * v });
    tone(ctx, { type: 'sine', from: 400, to: 300, start: 0.3, duration: 0.08, volume: 0.2 * v });
  },
  noPeas: (ctx, v) => tone(ctx, { type: 'square', from: 150, to: 130, duration: 0.15, volume: 0.08 * v }),
  waveStart: (ctx, v) => notes(ctx, 'square', [440, 660], 0.08, 0.08 * v),
  waveCleared: (ctx, v) => notes(ctx, 'triangle', [523, 659, 784, 1047], 0.09, 0.2 * v, 0.3),
  craig: (ctx, v) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, { type: 'sine', from: f, start: i * 0.05, duration: 0.8, volume: 0.08 * v }));
  },
  bossArrives: (ctx, v) => {
    tone(ctx, { type: 'sawtooth', from: 110, to: 65, duration: 0.9, volume: 0.18 * v });
    noise(ctx, { filter: 'lowpass', from: 300, duration: 0.5, volume: 0.35 * v });
  },
  whistle: (ctx, v) => {
    tone(ctx, { type: 'sine', from: 1500, to: 2200, duration: 0.14, volume: 0.15 * v });
    tone(ctx, { type: 'sine', from: 1500, to: 2200, start: 0.2, duration: 0.14, volume: 0.15 * v });
  },
  bossDefeated: (ctx, v) => {
    tone(ctx, { type: 'sawtooth', from: 300, to: 80, duration: 0.5, volume: 0.12 * v });
    notes(ctx, 'triangle', [523, 659, 784, 1047, 1319], 0.1, 0.18 * v, 0.4);
  },
  win: (ctx, v) => notes(ctx, 'triangle', [392, 523, 659, 784, 1047], 0.12, 0.2 * v, 0.6),
  lose: (ctx, v) => {
    notes(ctx, 'triangle', [392, 370, 349], 0.25, 0.2 * v);
    tone(ctx, { type: 'triangle', from: 330, to: 300, start: 0.75, duration: 0.8, volume: 0.2 * v, vibrato: 8 });
  },
  tap: (ctx, v) => tone(ctx, { type: 'sine', from: 800, duration: 0.03, volume: 0.1 * v }),
};
