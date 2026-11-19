/**
 * Turns pixel canvases from src/art into Phaser textures, once, on demand.
 * The game never loads an image file: every sprite is made here from code.
 */
import Phaser from 'phaser';
import { Px, type RoleColors } from '../art/pixel';
import { buildPerson, roleColorsFor, type Face, type Look, type Pose } from '../art/sprites/people';
import { BOX_SLICE, BOX_SRC, BOX_STYLES, boxFor, type BoxName } from '../art/sprites/ui';
import { iconPx } from '../art/sprites/icons';
import { decorPx } from '../art/sprites/decor';

export function pxToCanvas(p: Px, roles?: RoleColors): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(p.w, p.h);
  img.data.set(p.rgba(roles));
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Adds the texture if it is not there yet and returns its key. */
export function bake(scene: Phaser.Scene, key: string, make: () => Px, roles?: RoleColors): string {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pxToCanvas(make(), roles));
  return key;
}

export function bakeBox(scene: Phaser.Scene, name: BoxName): string {
  return bake(scene, `box:${name}`, () => boxFor(name));
}

export const BOX_INSET = BOX_SLICE;
export { BOX_SRC, BOX_STYLES };

export function personKey(look: Look, pose: Pose, face: Face): string {
  return `p:${look.skin}.${look.hair}.${look.hairColor}.${look.outfit}.${look.accessory}:${pose}:${face}`;
}

export function bakePerson(scene: Phaser.Scene, look: Look, pose: Pose, face: Face): string {
  return bake(scene, personKey(look, pose, face), () => buildPerson(look, pose, face), roleColorsFor(look));
}

/** A tiny round badge, for things that do not have an icon yet. */
function fallbackIcon(): Px {
  const p = new Px(8, 8);
  p.ellipse(3.5, 3.5, 2.6, 2.6, 'violet1');
  p.set(2, 2, 'violet2').set(3, 2, 'violet2').set(2, 3, 'violet2');
  return p.halo('ink0');
}

export function bakeIcon(scene: Phaser.Scene, name: string): string {
  return bake(scene, `icon:${name}`, () => iconPx(name) ?? fallbackIcon());
}

/** A solid one pixel white texture. Tint it for rectangles that never blur. */
export function bakePixel(scene: Phaser.Scene): string {
  if (!scene.textures.exists('px')) {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 2, 2);
    scene.textures.addCanvas('px', c);
  }
  return 'px';
}

/** A person sitting at a desk: legs cut off, the desk hides the rest. */
export function bakeSeated(scene: Phaser.Scene, look: Look, pose: Pose, face: Face): string {
  return bake(scene, `${personKey(look, pose, face)}:seated`, () => buildPerson(look, pose, face).crop(0, 0, 16, 19), roleColorsFor(look));
}

export function bakeDecor(scene: Phaser.Scene, id: string): string | null {
  const key = `decor:${id}`;
  if (scene.textures.exists(key)) return key;
  const p = decorPx(id);
  if (!p) return null;
  return bake(scene, key, () => p);
}
