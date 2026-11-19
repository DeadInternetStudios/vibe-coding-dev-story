/**
 * A list that scrolls. Drag it, flick it, use the wheel or the arrow keys.
 *
 * The rows are drawn once onto one tall picture and the window shows a slice of it.
 * That clips them exactly, which flat game objects cannot do in WebGL, and a scroll
 * is then just moving the slice. So rows are fixed pictures: they cannot animate or
 * take taps.
 */
import type Phaser from 'phaser';
import { C } from '../core/theme';
import { rect, type Scene } from './kit';
import { clampScroll, coast, stackRows, thumbRect } from './scrollMath';

export interface ScrollRow {
  h: number;
  /** everything in the row, drawn from its own 0,0. It is drawn once and then destroyed. */
  node: Phaser.GameObjects.Container;
}

export interface ScrollListOpts {
  /** the window with its frame, in the coordinates of the container the list goes in */
  x: number;
  y: number;
  w: number;
  h: number;
  rows: ScrollRow[];
  gap: number;
  /** the row to bring to the top when the list opens */
  start?: number;
}

const INSET = 3;
const GUTTER = 7;
const PAD = 3;
const WHEEL = 0.4;
const KEY_STEP = 14;
/** the fastest a flick can carry the list, in pixels per millisecond */
const MAX_FLICK = 2.5;

let pictures = 0;

/** How wide a row can be in a window of width `w`. */
export function rowWidth(w: number): number {
  return w - INSET - GUTTER;
}

export function scrollList(scene: Scene, o: ScrollListOpts): Phaser.GameObjects.Container {
  const { x, y, w, h } = o;
  const { tops, total } = stackRows(o.rows.map((r) => r.h), o.gap);
  const content = total + PAD * 2;
  const view = h - 2;
  const inner = w - 2;
  let pos = 0;
  let vel = 0;
  let drag: { y: number; t: number } | null = null;

  const key = `scroll-picture-${pictures++}`;
  const picture = scene.textures.addDynamicTexture(key, inner, Math.max(content, view));
  if (!picture) throw new Error('no room for the list picture');
  picture.fill(C.ink0);
  o.rows.forEach((r, i) => {
    r.node.setPosition(INSET - 1, PAD + tops[i]!);
    picture.draw(r.node);
  });
  picture.render();
  o.rows.forEach((r) => r.node.destroy());

  const slice = scene.add.image(x + 1, y + 1, key).setOrigin(0, 0);
  const track = rect(scene, x + w - 5, y + 3, 3, view - 4, C.ink1);
  const thumb = rect(scene, x + w - 5, y + 3, 3, 8, C.orange2);
  const scrollTo = (to: number) => {
    pos = clampScroll(to, content, view);
    const top = Math.round(pos);
    // a crop only hides parts of the picture, it does not move the visible part, so the picture moves up as the slice moves down
    slice.setPosition(x + 1, y + 1 - top).setCrop(0, top, inner, view);
    const t = thumbRect(content, view, top, view - 4);
    track.setVisible(!!t);
    thumb.setVisible(!!t);
    if (t) thumb.setPosition(x + w - 5, y + 3 + t.y).setDisplaySize(3, t.h);
  };

  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive();
  const layer = scene.add.container(0, 0, [
    // the frame: dark, with the corners cut like every other box
    rect(scene, x + 1, y, w - 2, h, C.ink0),
    rect(scene, x, y + 1, w, h - 2, C.ink0),
    slice,
    track,
    thumb,
    zone,
  ]);
  scrollTo(o.start === undefined ? 0 : PAD + (tops[o.start] ?? 0) - 2);

  zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
    drag = { y: p.y, t: performance.now() };
    vel = 0;
  });
  zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
    vel = 0;
    scrollTo(pos + dy * WHEEL);
  });
  const move = (p: Phaser.Input.Pointer) => {
    if (!drag) return;
    const now = performance.now();
    const dy = p.y - drag.y;
    vel = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, vel * 0.6 + (-dy / Math.max(1, now - drag.t)) * 0.4));
    drag = { y: p.y, t: now };
    scrollTo(pos - dy);
  };
  const release = () => {
    if (!drag) return;
    if (performance.now() - drag.t > 90) vel = 0;
    drag = null;
  };
  const tick = (_time: number, dt: number) => {
    if (drag || vel === 0) return;
    const c = coast(vel, Math.min(dt, 50));
    const before = pos;
    scrollTo(pos + c.move);
    vel = pos === before ? 0 : c.vel;
  };
  const keys: [string, () => void][] = [
    ['keydown-UP', () => scrollTo(pos - KEY_STEP)],
    ['keydown-DOWN', () => scrollTo(pos + KEY_STEP)],
    ['keydown-PAGE_UP', () => scrollTo(pos - view + KEY_STEP)],
    ['keydown-PAGE_DOWN', () => scrollTo(pos + view - KEY_STEP)],
    ['keydown-HOME', () => scrollTo(0)],
    ['keydown-END', () => scrollTo(content)],
  ];

  scene.input.on('pointermove', move);
  scene.input.on('pointerup', release);
  scene.events.on('update', tick);
  for (const [name, fn] of keys) scene.input.keyboard?.on(name, fn);
  layer.once('destroy', () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', release);
    scene.events.off('update', tick);
    for (const [name, fn] of keys) scene.input.keyboard?.off(name, fn);
    scene.textures.remove(key);
  });
  return layer;
}
