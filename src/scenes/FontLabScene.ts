import Phaser from 'phaser';
import { bakeBitmapFont, loadWebFonts, type PixelFontSpec } from '../core/fonts';

const SPECS: PixelFontSpec[] = [
  { key: 'psp8', family: 'Press Start 2P', size: 8 },
  { key: 'silk8', family: 'Silkscreen', size: 8 },
  { key: 'silk8b', family: 'Silkscreen', size: 8, weight: 700 },
  { key: 'pix12', family: 'Pixelify Sans', size: 12 },
  { key: 'pix16', family: 'Pixelify Sans', size: 16 },
  { key: 'pix16b', family: 'Pixelify Sans', size: 16, weight: 700 },
  { key: 'j10', family: 'Jersey 10', size: 10 },
  { key: 'j15', family: 'Jersey 15', size: 15 },
  { key: 'j20', family: 'Jersey 20', size: 20 },
  { key: 'tiny8', family: 'Tiny5', size: 8 },
  { key: 'vt16', family: 'VT323', size: 16 },
  { key: 'dg16', family: 'DotGothic16', size: 16 },
];

export class FontLabScene extends Phaser.Scene {
  constructor() {
    super('FontLab');
  }

  create() {
    void this.run();
  }

  private async run() {
    await loadWebFonts(SPECS);
    for (const s of SPECS) bakeBitmapFont(this, s);
    const show = new Set((new URLSearchParams(location.search).get('f') ?? '').split(',').filter(Boolean));
    const sample = "Vibe Coding Dev Story $12,500 0123456789";
    const sample2 = "You're absolutely right! Great catch! u/Dave: Did anyone read the diff?";
    let y = 4;
    for (const s of SPECS) {
      if (show.size && !show.has(s.key)) continue;
      this.add.bitmapText(4, y, s.key + '-o', `${s.key}: ${sample}`).setTint(0xffd2a8);
      const f = this.cache.bitmapFont.get(s.key + '-o').data;
      y += f.lineHeight + 1;
      this.add.bitmapText(4, y, s.key, sample2).setTint(0xf6e8cf);
      y += f.lineHeight + 3;
    }
    this.cameras.main.setBackgroundColor(0x1e1a3a);
    (window as unknown as { __fontsDone?: boolean }).__fontsDone = true;
  }
}
