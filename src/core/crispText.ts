import Phaser from 'phaser';

/**
 * Phaser 4 rounds the corners of every image it draws, but not the corners of the letters in a BitmapText.
 * A label with its origin on a half pixel (centered text of odd width, or the second line of centered text)
 * puts its letters between pixels, and the sampler then drops a column of one letter and doubles one of another:
 * "startup" reads "startcp". This draws bitmap text the way Phaser draws images, with every corner on a whole pixel.
 */

interface Quad {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface Glyph {
  width: number;
  height: number;
}

interface Letter {
  code: number;
  glyph: Glyph;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Tint {
  tintEffect: number;
  tintTopLeft: number;
  tintTopRight: number;
  tintBottomLeft: number;
  tintBottomRight: number;
}

interface Submitter {
  run(context: unknown, src: unknown, parentMatrix: unknown, index: number, texture: unknown, geometry: unknown, tint: Tint): void;
}

interface Text {
  _text: string;
  displayOriginX: number;
  displayOriginY: number;
  dropShadowX: number;
  dropShadowY: number;
  charColors: Record<number, unknown>;
  tintMode: number;
  tintTopLeft: number;
  tintTopRight: number;
  tintBottomLeft: number;
  tintBottomRight: number;
  _alphaTL: number;
  _alphaTR: number;
  _alphaBL: number;
  _alphaBR: number;
  frame: unknown;
  customRenderNodes: { Submitter?: Submitter };
  defaultRenderNodes: { Submitter: Submitter };
  getTextBounds(round: boolean): { characters: Letter[] };
}

interface Context {
  camera: { addToRenderList(obj: unknown): void };
  useCanvas: boolean;
}

type Render = (renderer: unknown, src: Text, context: Context, parentMatrix?: unknown) => void;

const tint: Tint = { tintEffect: 0, tintTopLeft: 0, tintTopRight: 0, tintBottomLeft: 0, tintBottomRight: 0 };
const texture = { frame: null as unknown, uvSource: null as unknown };
const geometry = { quad: new Float32Array(8) };

export function crispBitmapText(): void {
  const proto = Phaser.GameObjects.BitmapText.prototype as unknown as { renderWebGL: Render };
  const original = proto.renderWebGL;
  const calcMatrix = Phaser.GameObjects.GetCalcMatrix as unknown as (src: unknown, camera: unknown, parent: unknown, ignoreCamera: boolean) => { calc: Quad };
  const tintOf = (Phaser.Renderer.WebGL.Utils as unknown as { getTintAppendFloatAlpha(rgb: number, a: number): number }).getTintAppendFloatAlpha;

  proto.renderWebGL = function crisp(this: unknown, renderer, src, context, parentMatrix) {
    if (src._text.length === 0) return;
    // shadows and per-letter colors are not used by this game; let Phaser draw those
    let plain = src.dropShadowX === 0 && src.dropShadowY === 0;
    for (const _ in src.charColors) plain = false;
    if (!plain) {
      original.call(this, renderer, src, context, parentMatrix);
      return;
    }
    context.camera.addToRenderList(src);
    const submitter = src.customRenderNodes.Submitter ?? src.defaultRenderNodes.Submitter;
    const { a, b, c, d, e, f } = calcMatrix(src, context.camera, parentMatrix, !context.useCanvas).calc;
    tint.tintEffect = src.tintMode;
    tint.tintTopLeft = tintOf(src.tintTopLeft, src._alphaTL);
    tint.tintTopRight = tintOf(src.tintTopRight, src._alphaTR);
    tint.tintBottomLeft = tintOf(src.tintBottomLeft, src._alphaBL);
    tint.tintBottomRight = tintOf(src.tintBottomRight, src._alphaBR);
    texture.frame = src.frame;
    const quad = geometry.quad;
    for (const letter of src.getTextBounds(false).characters) {
      const glyph = letter.glyph;
      if (letter.code === 32 || glyph.width === 0 || glyph.height === 0) continue;
      const x = letter.x - src.displayOriginX;
      const y = letter.y - src.displayOriginY;
      const xw = x + letter.w;
      const yh = y + letter.h;
      quad[0] = Math.round(x * a + y * c + e);
      quad[1] = Math.round(x * b + y * d + f);
      quad[2] = Math.round(x * a + yh * c + e);
      quad[3] = Math.round(x * b + yh * d + f);
      quad[4] = Math.round(xw * a + yh * c + e);
      quad[5] = Math.round(xw * b + yh * d + f);
      quad[6] = Math.round(xw * a + y * c + e);
      quad[7] = Math.round(xw * b + y * d + f);
      texture.uvSource = glyph;
      submitter.run(context, src, undefined, 0, texture, geometry, tint);
    }
  };
}
