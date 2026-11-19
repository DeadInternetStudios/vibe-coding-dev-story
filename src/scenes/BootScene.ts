import Phaser from 'phaser';
import { bakeBitmapFont, loadWebFonts } from '../core/fonts';
import { FONT_SPECS } from '../core/fontSpecs';
import { app } from '../core/app';
import { buildFromSource } from '../content/runtime';

/** Loads the web fonts, bakes them into bitmap fonts, builds the content, then moves on. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    loadWebFonts(FONT_SPECS)
      .then(() => {
        for (const spec of FONT_SPECS) bakeBitmapFont(this, spec);
        app.content = buildFromSource();
        document.getElementById('boot')?.classList.add('done');
        const first = new URLSearchParams(location.search).get('scene') ?? 'Title';
        this.scene.start(first);
      })
      .catch((err) => {
        const boot = document.getElementById('boot');
        if (boot) boot.textContent = `could not start: ${String(err)}`;
        console.error(err);
      });
  }
}
