import Phaser from 'phaser';
import { audio } from '../../core/audio';
import { copyText, shareText } from '../../core/share';
import type { GameState } from '../../sim/types';
import { button, type ButtonObj } from '../../ui/kit';
import { layoutOf } from '../../ui/layout';
import { Modal } from '../../ui/modal';
import { CARD_H, CARD_W, cardFacts, cardPng, drawCard } from './card';

const FILE = 'vibe-coding-dev-story.png';

/** Say something on a button for a moment, then put the old words back. */
function flash(scene: Phaser.Scene, b: ButtonObj, text: string, back: string): void {
  if (!b.active) return;
  b.setText(text);
  scene.time.delayedCall(1700, () => b.active && b.setText(back));
}

/** Where the card says to play: the real address, or a plain line when this is a local copy. */
function whereToPlay(): string {
  const host = location.host;
  return !host || /^(localhost|127\.|192\.168\.)/.test(host) ? 'play it in your browser' : host;
}

/**
 * The share popup: the card as a picture, and three ways to use it. Copy the post text for Reddit,
 * save the picture, or hand it to the phone's share sheet.
 */
export function openShare(scene: Phaser.Scene, s: GameState, endingTitle: string | undefined, hold?: () => () => void): Modal | null {
  const facts = cardFacts(s, endingTitle, whereToPlay());
  if (!facts) return null;
  const L = layoutOf(scene);
  const w = Math.min(L.W - 6, CARD_W + 16);
  const canShareFiles = typeof navigator.canShare === 'function' && typeof navigator.share === 'function';
  // the preview shows the whole card on any screen: smaller than the card when the popup is narrower or shorter than it
  const below = 8 + 22 + (canShareFiles ? 22 : 0) + 8;
  const fit = Math.min(1, (w - 8) / CARD_W, (L.H - 6 - 22 - below) / CARD_H);
  const pw = Math.floor(CARD_W * fit);
  const ph = Math.floor(CARD_H * fit);
  const h = Math.min(L.H - 6, 22 + ph + below);
  const m = new Modal(scene, { w, h, title: 'SHARE YOUR RUN', closable: true, hold });
  // full size is drawn in card pixels, crisp; a smaller one is drawn twice as big and shrunk smoothly, so the words stay readable
  const preview = drawCard(scene, facts, fit < 1 ? 2 : 1, fit < 1).setOrigin(0, 0).setPosition(Math.floor((w - pw) / 2), 21);
  if (fit < 1) preview.setScale(fit / 2);
  m.add(preview);

  // the big copy is made once, in the background, so a share sheet opens at the tap
  const file: Promise<File> = cardPng(scene, facts).then((blob) => new File([blob], FILE, { type: 'image/png' }));
  file.catch(() => undefined);

  const by = 21 + ph + 8;
  const bw = Math.floor((w - 16 - 4) / 2);
  const copy: ButtonObj = button(scene, 8, by, bw, 18, 'COPY POST', () => {
    void copyText(shareText(s, endingTitle, `${location.origin}${location.pathname}`)).then((ok) => {
      audio.sfx(ok ? 'coin' : 'deny');
      flash(scene, copy, ok ? 'COPIED' : 'NO LUCK', 'COPY POST');
    });
  }, { kind: 'orange', icon: 'note' });
  const save: ButtonObj = button(scene, 8 + bw + 4, by, bw, 18, 'SAVE PICTURE', () => {
    void file.then((f) => {
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url;
      a.download = FILE;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      audio.sfx('confirm');
      flash(scene, save, 'SAVED', 'SAVE PICTURE');
    }, () => {
      audio.sfx('deny');
      flash(scene, save, 'NO LUCK', 'SAVE PICTURE');
    });
  }, { kind: 'teal', icon: 'ship' });
  m.add(copy);
  m.add(save);

  if (canShareFiles) {
    const send: ButtonObj = button(scene, 8, by + 22, w - 16, 18, 'SHARE...', () => {
      void file.then(async (f) => {
        const data = { files: [f], title: 'Vibe Coding Dev Story', text: shareText(s, endingTitle, `${location.origin}${location.pathname}`) };
        if (!navigator.canShare(data)) {
          flash(scene, send, 'NOT HERE', 'SHARE...');
          return;
        }
        try {
          await navigator.share(data);
        } catch {
          /* closed the sheet: nothing to report */
        }
      });
    }, { kind: 'violet', icon: 'star' });
    m.add(send);
  }
  return m;
}
