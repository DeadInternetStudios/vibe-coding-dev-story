import Phaser from 'phaser';
import { app } from '../../core/app';
import { feature } from '../../core/features';
import { loadSave, saveSettings, writeSave } from '../../core/save';
import { decodeSave, encodeSave } from '../../core/saveCode';
import { C, F } from '../../core/theme';
import { button, label, slider, uiEvents } from '../kit';
import { Modal } from '../modal';
import { layoutOf } from '../layout';

/** Volume sliders, a few switches, and the UI size. Works from the title and from inside the game. */
export function openSettings(scene: Phaser.Scene, hold?: () => () => void, onClose?: () => void): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 250);
  const h = Math.min(L.H - 8, feature('save') ? 190 : 170);
  const m = new Modal(scene, { w, h, title: 'SETTINGS', closable: true, hold, onClose });
  const s = app.settings;
  const commit = () => {
    saveSettings(s);
    uiEvents.emit('settings');
  };
  let y = 22;
  const rowH = 20;
  const sliders: [string, 'volMaster' | 'volMusic' | 'volSfx' | 'volVoice'][] = [
    ['MASTER', 'volMaster'],
    ['MUSIC', 'volMusic'],
    ['SOUND FX', 'volSfx'],
    ['VOICES', 'volVoice'],
  ];
  for (const [name, key] of sliders) {
    m.add(label(scene, 10, y + 4, name, { font: F.caps, tint: C.ink1 }));
    const val = label(scene, w - 12, y + 4, `${Math.round(s[key] * 100)}`, { font: F.body, tint: C.ink3, origin: [1, 0] });
    m.add(val);
    m.add(
      slider(scene, 82, y, w - 82 - 34, s[key], (v) => {
        s[key] = v;
        val.setText(`${Math.round(v * 100)}`);
        commit();
      }),
    );
    y += rowH - 4;
  }
  y += 6;
  // four switches in two columns; SOUND is the one that is on while `muted` is off
  const toggles: [string, 'subtitles' | 'reducedMotion' | 'shake' | 'muted', boolean][] = [
    ['SUBTITLES', 'subtitles', false],
    ['SCREEN SHAKE', 'shake', false],
    ['CALM MODE', 'reducedMotion', false],
    ['SOUND', 'muted', true],
  ];
  const colW = Math.floor((w - 24) / 2);
  toggles.forEach(([name, key, inverted], i) => {
    const on = () => (inverted ? !s[key] : s[key]);
    const text = () => `${name} ${on() ? 'ON' : 'OFF'}`;
    const b = button(scene, 10 + (i % 2) * (colW + 4), y + Math.floor(i / 2) * 17, colW, 14, text(), () => {
      s[key] = !s[key];
      b.setText(text());
      b.setKind(on() ? 'teal' : 'plum');
      commit();
    }, { kind: on() ? 'teal' : 'plum' });
    m.add(b);
  });
  y += 34;
  m.add(label(scene, 10, y + 4, 'UI SIZE', { font: F.caps, tint: C.ink1 }));
  const sizeNames = ['SMALL', 'NORMAL', 'BIG'];
  const sizeBtn = button(scene, w - 78, y, 68, 14, sizeNames[s.uiSize + 1]!, () => {
    s.uiSize = (((s.uiSize + 2) % 3) - 1) as -1 | 0 | 1;
    sizeBtn.setText(sizeNames[s.uiSize + 1]!);
    commit();
    app.refreshViewport?.();
  }, { kind: 'cream' });
  m.add(sizeBtn);
  y += 20;
  // the save as one line of text: copy it here, paste it on another device
  const FOOT = 'tap anywhere outside to close';
  const foot = label(scene, w / 2, h - 12, FOOT, { font: F.body, tint: C.ink3, origin: [0.5, 0], maxWidth: w - 8, align: 'center' });
  m.add(foot);
  const say = (text: string) => {
    foot.setText(text);
    scene.time.delayedCall(3200, () => foot.active && foot.setText(FOOT));
  };
  if (feature('save')) {
    m.add(label(scene, 10, y + 4, 'SAVE CODE', { font: F.caps, tint: C.ink1 }));
    m.add(button(scene, w - 124, y, 54, 14, 'COPY', () => void copySave(scene).then(say), { kind: 'cream' }));
    m.add(button(scene, w - 66, y, 56, 14, 'LOAD', () => void loadSaveCode().then(say), { kind: 'cream' }));
  }
  return m;
}

/** The running game when there is one (the saved copy can be a week old), else what the browser has stored. */
async function copySave(scene: Phaser.Scene): Promise<string> {
  const state = (scene.scene.key === 'Office' ? app.session?.s : undefined) ?? loadSave();
  if (!state) return 'No save yet. Play a bit first.';
  const code = encodeSave(state);
  try {
    await navigator.clipboard.writeText(code);
    return 'Save code copied. Paste it anywhere safe.';
  } catch {
    window.prompt('Copy your save code (select all, copy):', code);
    return 'Save code ready.';
  }
}

/** Reads a save code from the clipboard, or asks for it, and puts it in as the save. The page reloads so the title offers CONTINUE. */
async function loadSaveCode(): Promise<string> {
  let code: string | null = null;
  try {
    code = await navigator.clipboard.readText();
  } catch {
    code = null;
  }
  if (!code || !decodeSave(code)) code = window.prompt('Paste your save code here:', '');
  if (!code) return 'Nothing loaded.';
  const state = decodeSave(code);
  if (!state) return 'That is not a save code from this game.';
  if (loadSave() && !window.confirm('Replace the save on this device with that one?')) return 'Kept your current save.';
  if (!writeSave(state)) return 'The browser would not store it.';
  window.setTimeout(() => window.location.reload(), 900);
  return 'Save loaded. Restarting...';
}
