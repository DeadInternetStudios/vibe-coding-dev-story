import Phaser from 'phaser';
import { app } from '../../core/app';
import { saveSettings } from '../../core/save';
import { C, F } from '../../core/theme';
import { button, label, slider, uiEvents } from '../kit';
import { Modal } from '../modal';
import { layoutOf } from '../layout';

/** Volume sliders, a few switches, and the UI size. Works from the title and from inside the game. */
export function openSettings(scene: Phaser.Scene, hold?: () => () => void, onClose?: () => void): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 250);
  const h = Math.min(L.H - 8, 170);
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
  m.add(label(scene, w / 2, h - 12, 'tap anywhere outside to close', { font: F.body, tint: C.ink3, origin: [0.5, 0] }));
  return m;
}
