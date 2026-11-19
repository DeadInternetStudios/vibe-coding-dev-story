import Phaser from 'phaser';
import { bakeBitmapFont, loadWebFonts } from '../core/fonts';
import { FONT_SPECS } from '../core/fontSpecs';
import { app } from '../core/app';
import { buildFromSource } from '../content/runtime';
import { Session } from '../game/session';

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
        const q = new URLSearchParams(location.search);
        const demoName = q.get('demo');
        if (demoName) {
          void import('../game/debug').then(({ buildDemo }) => {
            const demo = buildDemo(app.content, demoName, Number(q.get('seed') ?? 11));
            if (!demo) throw new Error(`no demo moment called ${demoName}`);
            if (q.get('notut')) demo.state.tutorial = Object.keys(app.content.story.tutorial);
            app.session = Session.resume(app.content, demo.state, app.settings.speed);
            if (q.get('paused')) app.session.paused = true;
            this.scene.start(demo.scene, demo.data);
          });
          return;
        }
        this.scene.start(q.get('scene') ?? 'Title');
      })
      .catch((err) => {
        const boot = document.getElementById('boot');
        if (boot) boot.textContent = `could not start: ${String(err)}`;
        console.error(err);
      });
  }
}
