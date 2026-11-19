import Phaser from 'phaser';
import { C, F } from '../../core/theme';
import { VERSION } from '../../core/version';
import { button, label } from '../kit';
import { Modal } from '../modal';
import { layoutOf } from '../layout';

/** What a player is owed: who made the parts, what the game keeps about them, and that the jokes are jokes. */
const ROWS: readonly (readonly [string, string])[] = [
  ['MADE WITH', 'Phaser 4. The pixel art, music and sound effects were made for this game. Fonts: Silkscreen, Jersey, Tiny5 and VT323, under the SIL Open Font License.'],
  ['AI VOICES', 'Twenty characters, each invented from a text description by Qwen3-TTS 1.7B VoiceDesign and rendered offline. A machine checked every clip. Sounds off? Turn AI VOICES down in Settings.'],
  ['PRIVACY', 'No accounts. No tracking. Your saves and scores stay in this browser, on this device.'],
  ['NOTE', 'A parody. Not affiliated with Reddit, Hacker News, Product Hunt, LinkedIn or anyone else named in a joke. Every post and person in here is made up.'],
];

/** Credits, privacy and the licence notices, one popup. Opens over Settings and hands the screen back when closed. */
export function openAbout(scene: Phaser.Scene, hold?: () => () => void): Modal {
  const L = layoutOf(scene);
  const w = Math.min(L.W - 8, 250);
  const textW = w - 20;
  const measure = (text: string): number => {
    const probe = label(scene, 0, 0, text, { font: F.body, maxWidth: textW });
    const height = probe.getTextBounds(true).global.height;
    probe.destroy();
    return height;
  };
  const gap = 5;
  const head = 10;
  const rowsH = ROWS.reduce((n, [, body]) => n + head + measure(body) + gap, 0);
  const h = Math.min(L.H - 8, Math.ceil(22 + 11 + rowsH + 22));
  const m = new Modal(scene, { w, h, title: 'ABOUT', closable: true, hold });
  let y = 21;
  m.add(label(scene, 10, y, `VIBE CODING DEV STORY  v${VERSION}`, { font: F.caps, tint: C.orange0 }));
  y += 11;
  for (const [name, body] of ROWS) {
    m.add(label(scene, 10, y, name, { font: F.caps, tint: C.ink1 }));
    y += head;
    const text = label(scene, 10, y, body, { font: F.body, tint: C.ink3, maxWidth: textW });
    m.add(text);
    y += Math.ceil(text.getTextBounds(true).global.height) + gap;
  }
  m.add(button(scene, 10, m.h - 20, 76, 14, 'LICENSES', () => window.open(new URL('third-party-notices.txt', document.baseURI).href, '_blank', 'noopener'), { kind: 'cream' }));
  m.add(button(scene, m.w - 66, m.h - 20, 56, 14, 'CLOSE', () => m.close(), { kind: 'plum' }));
  return m;
}
