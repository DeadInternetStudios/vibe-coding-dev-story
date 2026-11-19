/**
 * The audition page (tools/audio/room.html). A button for every sound effect and
 * song, sliders for the whole public surface of SoundEngine, and a peak meter.
 *
 * QUIET BY DEFAULT: no AudioContext is created until a person presses Start, so
 * loading the page (or opening it in a script) makes no sound.
 *
 * Open it with `npm run dev`, then /tools/audio/room.html.
 */
import { SoundEngine } from '../../src/audio/engine';
import type { SfxId } from '../../src/audio/ids';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`room.html has no #${id}`);
  return found as T;
}

/** A range input with its value printed next to it. */
function slider(id: string, onChange: (value: number) => void, format: (v: number) => string = (v) => v.toFixed(2)): () => number {
  const input = el<HTMLInputElement>(id);
  const out = input.parentElement!.querySelector('output')!;
  const read = (): number => Number(input.value);
  const apply = (): void => {
    out.textContent = format(read());
    onChange(read());
  };
  input.addEventListener('input', apply);
  out.textContent = format(read());
  return read;
}

let ctx: AudioContext | null = null;
let engine: SoundEngine | null = null;
let analyser: AnalyserNode | null = null;
let peakHold = 0;

/** Create the context on first use. Only ever called from a click. */
async function start(): Promise<SoundEngine> {
  if (!engine) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    // like Phaser: the engine plays into the game's master node
    const master = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    engine = new SoundEngine(ctx, master);
    applyVolumes();
    engine.setMuted(el<HTMLInputElement>('mute').checked);
    requestAnimationFrame(drawMeter);
  }
  await engine.resume();
  el('state').textContent = `audio on (${ctx!.sampleRate} Hz, ${ctx!.state})`;
  el('start').classList.add('on');
  el('start').textContent = 'Audio running';
  return engine;
}

const volume = {
  master: slider('v-master', () => applyVolumes()),
  music: slider('v-music', () => applyVolumes()),
  sfx: slider('v-sfx', () => applyVolumes()),
};
function applyVolumes(): void {
  engine?.setVolumes({ master: volume.master(), music: volume.music(), sfx: volume.sfx() });
}

const intensity = slider('intensity', (v) => engine?.setIntensity(v));
slider('tempo', (v) => engine?.setTempoScale(v), (v) => `${v.toFixed(2)}x`);
const sfxVolume = slider('s-volume', () => undefined);
const sfxRate = slider('s-rate', () => undefined, (v) => `${v.toFixed(2)}x`);
const sfxPan = slider('s-pan', () => undefined);

el('start').addEventListener('click', () => void start());
el<HTMLInputElement>('mute').addEventListener('change', (e) => engine?.setMuted((e.target as HTMLInputElement).checked));
el('duck').addEventListener('click', () => engine?.duck(0.35, 150));
el('unduck').addEventListener('click', () => engine?.unduck(400));
el('stop-music').addEventListener('click', () => engine?.stopMusic(600));
el('peak-reset').addEventListener('click', () => {
  peakHold = 0;
});

// ------------------------------------------------------------------ music
const songs = el('songs');
for (const m of SoundEngine.MUSIC) {
  const row = document.createElement('div');
  row.className = 'song';
  const btn = document.createElement('button');
  btn.textContent = `play ${m.label}`;
  btn.dataset.music = m.id;
  btn.addEventListener('click', async () => (await start()).music(m.id, { fadeMs: 400, intensity: intensity() }));
  const info = document.createElement('div');
  const id = document.createElement('div');
  id.className = 'note';
  id.textContent = m.id;
  const chips = document.createElement('div');
  chips.className = 'chips';
  for (const layer of m.layers) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = layer;
    chips.append(chip);
  }
  info.append(id, chips);
  row.append(btn, info);
  songs.append(row);
}

setInterval(() => {
  const now = engine?.currentMusic() ?? null;
  el('now').textContent = now ?? 'nothing';
  for (const b of songs.querySelectorAll<HTMLButtonElement>('button[data-music]')) b.classList.toggle('playing', b.dataset.music === now);
}, 250);

// ------------------------------------------------------------------ sfx
const play = async (id: SfxId): Promise<void> => (await start()).sfx(id, { volume: sfxVolume(), rate: sfxRate(), pan: sfxPan() });

const groups = el('sfx-groups');
const families = [...new Set(SoundEngine.SFX.map((s) => s.family))];
for (const family of families) {
  const h = document.createElement('h3');
  h.textContent = family;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const s of SoundEngine.SFX.filter((x) => x.family === family)) {
    const b = document.createElement('button');
    b.textContent = s.id;
    b.title = s.label;
    b.dataset.sfx = s.id;
    b.addEventListener('click', () => void play(s.id));
    grid.append(b);
  }
  groups.append(h, grid);
}

el('pile').addEventListener('click', async () => {
  await start();
  for (let i = 0; i < 200; i++) {
    const s = SoundEngine.SFX[Math.floor(Math.random() * SoundEngine.SFX.length)]!;
    setTimeout(() => void play(s.id), Math.random() * 2000);
  }
});

// ------------------------------------------------------------------ meter
const canvas = el<HTMLCanvasElement>('meter');
const g = canvas.getContext('2d')!;
const FLOOR_DB = -60;
const toX = (db: number): number => ((Math.max(db, FLOOR_DB) - FLOOR_DB) / -FLOOR_DB) * canvas.width;

function drawMeter(): void {
  if (!analyser) return;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  peakHold = Math.max(peakHold, peak);
  const db = 20 * Math.log10(Math.max(peak, 1e-6));
  const holdDb = 20 * Math.log10(Math.max(peakHold, 1e-6));
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = db > -3 ? '#ff6b8b' : '#6be3a5';
  g.fillRect(0, 4, toX(db), canvas.height - 8);
  g.fillStyle = '#ece8ff';
  g.fillRect(toX(holdDb) - 1, 0, 2, canvas.height);
  g.fillStyle = '#ff6b8b';
  g.fillRect(toX(-3), 0, 1, canvas.height);
  const label = el('peak');
  label.textContent = peakHold > 0 ? `${holdDb.toFixed(1)} dBFS` : '-inf dBFS';
  label.classList.toggle('hot', holdDb > -3);
  requestAnimationFrame(drawMeter);
}
