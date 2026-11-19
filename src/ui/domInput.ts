import Phaser from 'phaser';

export interface EditBox {
  /** top left in art pixels */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Puts a real text field exactly over a box on the canvas, so phones show their
 * keyboard and desktop gets caret and selection for free. It removes itself
 * when you press enter, tap away, or press escape.
 */
export function editText(scene: Phaser.Scene, box: EditBox, current: string, maxLen: number, onDone: (value: string) => void): void {
  const bounds = scene.scale.canvasBounds;
  const sx = scene.scale.displayScale.x ? 1 / scene.scale.displayScale.x : 1;
  const sy = scene.scale.displayScale.y ? 1 / scene.scale.displayScale.y : 1;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.maxLength = maxLen;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  const scale = sx;
  Object.assign(input.style, {
    position: 'fixed',
    left: `${bounds.x + box.x * scale}px`,
    top: `${bounds.y + box.y * sy}px`,
    width: `${box.w * scale}px`,
    height: `${box.h * sy}px`,
    boxSizing: 'border-box',
    padding: `0 ${2 * scale}px`,
    margin: '0',
    border: `${scale}px solid #ff7a2b`,
    borderRadius: '0',
    background: '#fff3df',
    color: '#241a3a',
    font: `${8 * scale}px/${box.h * sy}px Silkscreen, monospace`,
    outline: 'none',
    zIndex: '10',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit: boolean) => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    input.remove();
    if (commit && v) onDone(v);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  scene.events.once('shutdown', () => finish(false));
}
