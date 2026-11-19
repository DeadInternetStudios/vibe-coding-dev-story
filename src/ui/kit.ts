/**
 * Building blocks for every screen. Everything is positioned in art pixels and
 * built from baked pixel textures and baked bitmap fonts, so nothing is ever
 * blurry and every screen reads as one game.
 */
import Phaser from 'phaser';
import { bakeBox, bakeIcon, bakePixel, BOX_INSET, BOX_SRC } from '../core/bake';
import { C, DEPTH, F, T, type FontKey } from '../core/theme';
import type { BoxName } from '../art/sprites/ui';

export type Scene = Phaser.Scene;

export interface LabelOpts {
  font?: FontKey;
  tint?: number;
  /** dark outline baked into the font, best on busy backgrounds */
  outline?: boolean;
  shadow?: boolean;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  /** [x, y] origin, default top left */
  origin?: [number, number];
  depth?: number;
}

export function label(scene: Scene, x: number, y: number, text: string, o: LabelOpts = {}): Phaser.GameObjects.BitmapText {
  const font = (o.font ?? F.body) + (o.outline ? '-o' : o.shadow ? '-s' : '');
  const align = o.align === 'center' ? 1 : o.align === 'right' ? 2 : 0;
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), font, text, undefined, align);
  t.setTint(o.tint ?? T.onDark);
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  if (o.origin) t.setOrigin(o.origin[0], o.origin[1]);
  if (o.depth !== undefined) t.setDepth(o.depth);
  return t;
}

/** Height of a line of a font, for stacking text. */
export function lineH(scene: Scene, font: FontKey = F.body): number {
  const data = scene.cache.bitmapFont.get(font).data as { lineHeight: number };
  return data.lineHeight;
}

export interface PanelObj extends Phaser.GameObjects.Container {
  boxW: number;
  boxH: number;
  setBoxSize(w: number, h: number): void;
}

/** A nine slice box with a hard drop shadow. x and y are the top left corner. */
export function panel(scene: Scene, x: number, y: number, w: number, h: number, style: BoxName = 'paper', shadow = true): PanelObj {
  const key = bakeBox(scene, style);
  const c = scene.add.container(Math.round(x), Math.round(y)) as PanelObj;
  const sh = scene.add.nineslice(2, 2, key, undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0).setTint(C.ink0).setAlpha(shadow ? 0.5 : 0);
  const body = scene.add.nineslice(0, 0, key, undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  c.add([sh, body]);
  c.boxW = w;
  c.boxH = h;
  c.setSize(w, h);
  c.setBoxSize = (nw: number, nh: number) => {
    sh.setSize(nw, nh);
    body.setSize(nw, nh);
    c.boxW = nw;
    c.boxH = nh;
    c.setSize(nw, nh);
  };
  return c;
}

export function iconImg(scene: Scene, name: string, x: number, y: number, scale = 1): Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x), Math.round(y), bakeIcon(scene, name)).setOrigin(0, 0).setScale(scale);
}

export type ButtonKind = 'orange' | 'teal' | 'cream' | 'plum' | 'berry' | 'violet';

const BTN_TEXT: Record<ButtonKind, number> = {
  orange: C.white,
  teal: C.white,
  cream: C.ink1,
  plum: C.cream,
  berry: C.white,
  violet: C.white,
};

const BTN_BOX: Record<ButtonKind, [BoxName, BoxName]> = {
  orange: ['btnOrange', 'btnOrangeDown'],
  teal: ['btnTeal', 'btnTealDown'],
  cream: ['btnCream', 'btnCreamDown'],
  plum: ['btnPlum', 'btnPlumDown'],
  berry: ['btnBerry', 'btnBerryDown'],
  violet: ['btnViolet', 'btnVioletDown'],
};

export interface ButtonOpts {
  kind?: ButtonKind;
  icon?: string;
  font?: FontKey;
  disabled?: boolean;
  /** shown on hover and long press */
  hint?: string;
  /** do not play the click sound, someone else will */
  silent?: boolean;
}

export interface ButtonObj extends Phaser.GameObjects.Container {
  setEnabled(on: boolean): void;
  setText(text: string): void;
  setKind(kind: ButtonKind): void;
  enabled: boolean;
  textObj: Phaser.GameObjects.BitmapText;
  boxW: number;
  boxH: number;
}

/** Event bus for click sounds so the kit does not need to know about audio. */
export const uiEvents = new Phaser.Events.EventEmitter();

export function button(scene: Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, o: ButtonOpts = {}): ButtonObj {
  let kind: ButtonKind = o.kind ?? 'orange';
  const c = scene.add.container(Math.round(x), Math.round(y)) as ButtonObj;
  const mk = (name: BoxName) => scene.add.nineslice(0, 0, bakeBox(scene, name), undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  const shadow = mk('night').setPosition(0, 2).setAlpha(0.55);
  const face = mk(BTN_BOX[kind][0]);
  // under a mouse pointer the face brightens: the same picture added on top of itself
  const glow = mk(BTN_BOX[kind][0]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  const font = o.font ?? F.caps;
  const lbl = label(scene, w / 2, h / 2 - 1, text, { font, tint: BTN_TEXT[kind], origin: [0.5, 0.5], shadow: kind !== 'cream' });
  c.add([shadow, face, glow, lbl]);
  let ic: Phaser.GameObjects.Image | null = null;
  if (o.icon) {
    ic = iconImg(scene, o.icon, 0, 0);
    c.add(ic);
    layoutIconText();
  }
  function layoutIconText() {
    if (!ic) return;
    const tw = lbl.width;
    const total = ic.width + (text ? 3 : 0) + tw;
    ic.setPosition(Math.round((w - total) / 2), Math.round((h - ic.height) / 2) - 1);
    lbl.setOrigin(0, 0.5).setPosition(Math.round((w - total) / 2) + ic.width + 3, Math.round(h / 2) - 1);
  }
  c.setSize(w, h);
  c.boxW = w;
  c.boxH = h;
  c.enabled = !o.disabled;
  let down = false;
  let over = false;
  const paint = () => {
    const name = !c.enabled ? 'btnOff' : down ? BTN_BOX[kind][1] : BTN_BOX[kind][0];
    face.setTexture(bakeBox(scene, name));
    const dy = down && c.enabled ? 1 : 0;
    face.y = dy;
    glow.setTexture(bakeBox(scene, name));
    glow.y = dy;
    glow.setAlpha(c.enabled && over && !down ? 0.22 : 0);
    lbl.y = (ic ? Math.round(h / 2) - 1 : h / 2 - 1) + dy;
    if (ic) ic.y = Math.round((h - ic.height) / 2) - 1 + dy;
    lbl.setTint(c.enabled ? BTN_TEXT[kind] : C.ink3);
    shadow.setAlpha(down || !c.enabled ? 0.2 : 0.55);
  };
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  c.add(zone);
  zone.on('pointerdown', () => {
    if (!c.enabled) return;
    down = true;
    paint();
  });
  const release = () => {
    if (!down) return;
    down = false;
    paint();
  };
  zone.on('pointerover', () => {
    over = true;
    paint();
  });
  zone.on('pointerout', () => {
    over = false;
    down = false;
    paint();
  });
  zone.on('pointerup', () => {
    if (!down) return;
    release();
    if (!o.silent) uiEvents.emit('click');
    onClick();
  });
  c.setEnabled = (on) => {
    c.enabled = on;
    paint();
  };
  c.setText = (t) => {
    text = t;
    lbl.setText(t);
    layoutIconText();
  };
  c.setKind = (k) => {
    kind = k;
    paint();
  };
  c.textObj = lbl;
  paint();
  return c;
}

/** A one pixel frame that lights up while a mouse pointer is over `zone`. For tiles and rows that are not buttons. Add the result next to the zone. */
export function hoverFrame(scene: Scene, zone: Phaser.GameObjects.Zone, x: number, y: number, w: number, h: number, tint: number = C.yellow): Phaser.GameObjects.Container {
  const frame = scene.add.container(Math.round(x), Math.round(y)).setAlpha(0);
  frame.add([rect(scene, 0, 0, w, 1, tint), rect(scene, 0, h - 1, w, 1, tint), rect(scene, 0, 0, 1, h, tint), rect(scene, w - 1, 0, 1, h, tint)]);
  zone.on('pointerover', () => frame.setAlpha(1));
  zone.on('pointerout', () => frame.setAlpha(0));
  return frame;
}

/** Small icon-only button, square. */
export function iconButton(scene: Scene, x: number, y: number, size: number, icon: string, onClick: () => void, kind: ButtonKind = 'plum'): ButtonObj {
  const b = button(scene, x, y, size, size, '', onClick, { kind, icon });
  return b;
}

export interface BarObj extends Phaser.GameObjects.Container {
  set(v: number, animate?: boolean): void;
  value: number;
}

/** A horizontal meter with a dark well, a colored fill and a highlight row. v is 0 to 1. */
export function bar(scene: Scene, x: number, y: number, w: number, h: number, fill: number, v = 0): BarObj {
  const c = scene.add.container(Math.round(x), Math.round(y)) as BarObj;
  const well = scene.add.nineslice(0, 0, bakeBox(scene, 'well'), undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  const px = bakePixel(scene);
  const fillImg = scene.add.image(1, 1, px).setOrigin(0, 0).setTint(fill);
  const shine = scene.add.image(1, 1, px).setOrigin(0, 0).setTint(C.white).setAlpha(0.35);
  c.add([well, fillImg, shine]);
  c.value = v;
  const inner = w - 2;
  const paint = (val: number) => {
    const fw = Math.max(0, Math.min(1, val)) * inner;
    fillImg.setDisplaySize(Math.round(fw), h - 2);
    shine.setDisplaySize(Math.round(fw), 1);
    fillImg.setVisible(fw >= 1);
    shine.setVisible(fw >= 1);
  };
  paint(v);
  c.set = (val, animate = true) => {
    const target = Math.max(0, Math.min(1, val));
    if (!animate || Math.abs(target - c.value) < 0.001) {
      c.value = target;
      paint(target);
      return;
    }
    scene.tweens.addCounter({
      from: c.value,
      to: target,
      duration: 220,
      ease: 'Sine.easeOut',
      onUpdate: (tw) => {
        c.value = tw.getValue() ?? target;
        paint(c.value);
      },
    });
  };
  c.setSize(w, h);
  return c;
}

export interface SliderObj extends Phaser.GameObjects.Container {
  set(v: number): void;
}

/** A horizontal slider, 0 to 1, in steps of one tenth. Drag or tap anywhere on the track. */
export function slider(scene: Scene, x: number, y: number, w: number, value: number, onChange: (v: number) => void): SliderObj {
  const c = scene.add.container(Math.round(x), Math.round(y)) as SliderObj;
  const h = 7;
  const track = scene.add.nineslice(0, 4, bakeBox(scene, 'well'), undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  const px = bakePixel(scene);
  const fill = scene.add.image(1, 5, px).setOrigin(0, 0).setTint(C.orange1);
  const knob = scene.add.nineslice(0, 0, bakeBox(scene, 'btnCream'), undefined, 7, 15, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  c.add([track, fill, knob]);
  let v = value;
  const paint = () => {
    const kx = Math.round(v * (w - 7));
    knob.x = kx;
    fill.setDisplaySize(Math.max(0, kx + 3), h - 2);
  };
  paint();
  const zone = scene.add.zone(-3, 0, w + 6, 15).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  c.add(zone);
  const apply = (p: Phaser.Input.Pointer) => {
    const local = p.x - c.x - 3;
    const nv = Math.round(Math.max(0, Math.min(1, local / (w - 7))) * 10) / 10;
    if (nv !== v) {
      v = nv;
      paint();
      onChange(v);
    }
  };
  let drag = false;
  zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
    drag = true;
    apply(p);
  });
  const move = (p: Phaser.Input.Pointer) => drag && apply(p);
  const stop = () => {
    if (drag) uiEvents.emit('click');
    drag = false;
  };
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', stop);
  c.once('destroy', () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', stop);
  });
  c.set = (nv: number) => {
    v = nv;
    paint();
  };
  c.setSize(w, 15);
  return c;
}

export interface ChoiceObj extends Phaser.GameObjects.Container {
  boxH: number;
  setEnabled(on: boolean): void;
}

/** A wide two line button: a title, and under it a small hint. Used for event choices and offers. */
export function choiceButton(scene: Scene, x: number, y: number, w: number, title: string, hint: string | undefined, enabled: boolean, onClick: () => void, kind: ButtonKind = 'cream'): ChoiceObj {
  const hintLabel = hint ? label(scene, 6, 13, hint, { font: F.body, tint: C.ink3, maxWidth: w - 12 }) : null;
  const h = hint ? 14 + (hintLabel?.height ?? 8) + 4 : 17;
  const c = scene.add.container(Math.round(x), Math.round(y)) as ChoiceObj;
  const mk = (name: BoxName) => scene.add.nineslice(0, 0, bakeBox(scene, name), undefined, w, h, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  const shadow = mk('night').setPosition(0, 2).setAlpha(0.5);
  const face = mk(BTN_BOX[kind][0]);
  const t = label(scene, 6, 3, title, { font: F.caps, tint: BTN_TEXT[kind] });
  c.add([shadow, face, t]);
  if (hintLabel) {
    hintLabel.setTint(kind === 'cream' ? C.ink3 : C.cream);
    c.add(hintLabel);
  }
  c.boxH = h;
  c.setSize(w, h);
  let on = enabled;
  let down = false;
  const paint = () => {
    face.setTexture(bakeBox(scene, !on ? 'btnOff' : down ? BTN_BOX[kind][1] : BTN_BOX[kind][0]));
    const dy = down && on ? 1 : 0;
    face.y = dy;
    t.y = 3 + dy;
    if (hintLabel) hintLabel.y = 13 + dy;
    t.setTint(on ? BTN_TEXT[kind] : C.ink3);
  };
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  c.add(zone);
  zone.on('pointerdown', () => {
    if (!on) return;
    down = true;
    paint();
  });
  zone.on('pointerout', () => {
    down = false;
    paint();
  });
  zone.on('pointerup', () => {
    if (!down) {
      if (!on) uiEvents.emit('deny');
      return;
    }
    down = false;
    paint();
    uiEvents.emit('click');
    onClick();
  });
  c.setEnabled = (v) => {
    on = v;
    paint();
  };
  paint();
  return c;
}

const CHIP_ICON: Record<string, string> = {
  cash: 'cash',
  tokens: 'token',
  karma: 'karma',
  spaghetti: 'spaghetti',
  mood: 'moodHappy',
  stat: 'features',
  progress: 'ship',
  hype: 'star',
  delay: 'clock',
  fire: 'cross',
  hire: 'hire',
  skill: 'prompt',
  xp: 'star',
  flag: 'note',
};

/** A little pill with an icon and a number, good news green, bad news red. Returns the pill and its width. */
export function chip(scene: Scene, x: number, y: number, kind: string, text: string, good: boolean): { c: Phaser.GameObjects.Container; w: number } {
  const t = label(scene, 13, 3, text, { font: F.body, tint: good ? C.green2 : C.pink });
  const w = Math.ceil(t.width) + 17;
  const bg = scene.add.nineslice(0, 0, bakeBox(scene, 'chipDark'), undefined, w, 13, BOX_INSET, BOX_INSET, BOX_INSET, BOX_INSET).setOrigin(0, 0);
  const iconName = kind === 'mood' ? (good ? 'moodHappy' : 'moodSad') : (CHIP_ICON[kind] ?? 'note');
  const ic = iconImg(scene, iconName, 3, 2);
  const c = scene.add.container(Math.round(x), Math.round(y), [bg, ic, t]);
  return { c, w };
}

/** Floating text that rises and fades. Good for +$ and +karma. */
export function pop(scene: Scene, x: number, y: number, text: string, tint: number = C.yellow, font: FontKey = F.caps, rise = 14): void {
  const t = label(scene, x, y, text, { font, tint, outline: true, origin: [0.5, 1], depth: DEPTH.fx + 50 });
  scene.tweens.add({ targets: t, y: y - rise, alpha: { from: 1, to: 0 }, duration: 900, ease: 'Sine.easeOut', delay: 150, onComplete: () => t.destroy() });
  t.setScale(1.5);
  scene.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
}

/** Pixel rectangle that never blurs. */
export function rect(scene: Scene, x: number, y: number, w: number, h: number, tint: number, alpha = 1): Phaser.GameObjects.Image {
  return scene.add.image(Math.round(x), Math.round(y), bakePixel(scene)).setOrigin(0, 0).setDisplaySize(w, h).setTint(tint).setAlpha(alpha);
}

export { fit } from './text';

export { BOX_SRC };
