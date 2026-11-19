import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/jersey-10/400.css';
import '@fontsource/jersey-15/400.css';
import '@fontsource/jersey-20/400.css';
import '@fontsource/tiny5/400.css';
import '@fontsource/vt323/400.css';
import '@fontsource/dotgothic16/400.css';
import { computeViewport } from './core/viewport';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { NewGameScene } from './scenes/NewGameScene';
import { OfficeScene } from './scenes/OfficeScene';
import { app } from './core/app';
import { audio } from './core/audio';
import { uiEvents } from './ui/kit';

const parent = document.getElementById('game')!;

function currentViewport() {
  return computeViewport(parent.clientWidth || window.innerWidth, parent.clientHeight || window.innerHeight, window.devicePixelRatio || 1, app.settings.uiSize);
}

const vp = currentViewport();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  width: vp.w,
  height: vp.h,
  backgroundColor: '#120f24',
  scale: { mode: Phaser.Scale.NONE, width: vp.w, height: vp.h, zoom: vp.cssPerPx },
  render: { pixelArt: true, antialias: false, roundPixels: true },
  input: { activePointers: 3 },
  banner: false,
  audio: { noAudio: true },
  scene: [BootScene, TitleScene, NewGameScene, OfficeScene],
});

let pending = 0;
function onResize() {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    const next = currentViewport();
    game.scale.setZoom(next.cssPerPx);
    if (next.w !== game.scale.width || next.h !== game.scale.height) game.scale.resize(next.w, next.h);
  });
}
app.refreshViewport = onResize;
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);

const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
uiEvents.on('click', () => audio.sfx('click'));
uiEvents.on('open', () => audio.sfx('open'));
uiEvents.on('settings', () => audio.applySettings());

(window as unknown as { __game: Phaser.Game }).__game = game;
