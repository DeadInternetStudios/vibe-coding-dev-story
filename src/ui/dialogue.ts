import Phaser from 'phaser';
import { bakePortrait } from '../core/bake';
import { audio } from '../core/audio';
import { C, DEPTH, F } from '../core/theme';
import type { DialogueStep } from '../content/types';
import { VOICE_NAMES } from '../content/voiceNames';
import { label, panel, rect } from './kit';
import { layoutOf } from './layout';
import { Speech } from './speech';
import type { StageCtx } from './ctx';

/**
 * Talking heads. A box at the bottom with a face, a name, and words that
 * arrive as they are spoken. Tap to show it all, tap again for the next line.
 */
export function dialogue(ctx: StageCtx, steps: DialogueStep[], onDone: () => void, opts: { title?: string; skippable?: boolean } = {}): void {
  const scene = ctx.scene;
  const L = layoutOf(scene);
  const release = ctx.hold('dialogue');
  const root = scene.add.container(0, 0).setDepth(DEPTH.modal + 20).setName('dialogue');
  const dim = rect(scene, 0, 0, L.W, L.H, C.ink0, 0.35).setInteractive();
  root.add(dim);
  const w = Math.min(L.W - 8, 330);
  const h = L.portrait ? 74 : 62;
  const x = Math.floor((L.W - w) / 2);
  // portrait: sit over the repo and revenue panels so the staff stay in view while they talk
  const roomTop = ctx.room?.root.y;
  const y = L.portrait ? (roomTop === undefined ? L.H - h - 128 : Math.max(6, Math.round(roomTop - h - 6))) : L.H - h - 66;
  const box = panel(scene, x, y, w, h, 'paper');
  root.add(box);
  const face = scene.add.image(x + 8, y + 8, bakePortrait(scene, 'system')).setOrigin(0, 0).setScale(2);
  const faceFrame = rect(scene, x + 6, y + 6, 36, 38, C.ink0, 1);
  const faceBg = rect(scene, x + 7, y + 7, 34, 36, C.sky, 1);
  root.add([faceFrame, faceBg, face]);
  const name = label(scene, x + 50, y + 6, '', { font: F.caps, tint: C.orange1 });
  const text = label(scene, x + 50, y + 17, '', { font: F.read, tint: C.ink1, maxWidth: w - 58 });
  const hint = label(scene, x + w - 8, y + h - 9, 'tap', { font: F.body, tint: C.ink3, origin: [1, 0] });
  root.add([name, text, hint]);
  scene.tweens.add({ targets: hint, alpha: { from: 1, to: 0.2 }, duration: 500, yoyo: true, repeat: -1 });
  let skip: ReturnType<typeof label> | null = null;
  if (opts.skippable !== false && steps.length > 1) {
    skip = label(scene, x + w - 8, y + 5, 'skip >>', { font: F.body, tint: C.ink3, origin: [1, 0] });
    root.add(skip);
  }
  let i = -1;
  let speech: Speech | null = null;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    speech?.stop();
    audio.stopVoice();
    release();
    root.destroy();
    onDone();
  };
  let mouthTimer: Phaser.Time.TimerEvent | null = null;
  const next = () => {
    i += 1;
    speech?.stop();
    mouthTimer?.remove();
    const step = steps[i];
    if (!step) {
      close();
      return;
    }
    face.setTexture(bakePortrait(scene, step.speaker));
    name.setText(step.speaker === 'system' ? 'SYSTEM' : (VOICE_NAMES[step.speaker] ?? step.speaker).toUpperCase());
    text.setText('');
    const sp = new Speech(scene, text);
    speech = sp;
    audio.sfx('bubble');
    void sp.say(step.line.text, step.speaker === 'system' ? undefined : step.line);
    mouthTimer = scene.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        face.y = y + 8 + (sp.finished ? 0 : sp.level > 0.5 ? -1 : 0);
      },
    });
  };
  dim.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (skip && p.x > x + w - 50 && p.y < y + 14 && p.y > y) {
      close();
      return;
    }
    if (speech && !speech.finished) speech.skip();
    else next();
  });
  next();
}
