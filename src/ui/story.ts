import { app } from '../core/app';
import type { DialogueStep } from '../content/types';
import { dialogue } from './dialogue';
import type { StageCtx } from './ctx';

/** The opening scene. Plays the intro, then the welcome tip, then hands control back. */
export function showIntro(ctx: StageCtx, onDone: () => void): void {
  dialogue(ctx, app.content.story.intro, () => {
    if (!beat(ctx, 'welcome', onDone)) onDone();
  });
}

/** A one time teaching moment. Returns true if it played, false if it was already seen. */
export function beat(ctx: StageCtx, key: string, onDone?: () => void): boolean {
  const s = ctx.session.s;
  const steps = app.content.story.tutorial[key];
  if (!steps || steps.length === 0 || s.tutorial.includes(key)) return false;
  s.tutorial.push(key);
  dialogue(ctx, steps, () => onDone?.(), { skippable: true });
  return true;
}

/** Play a keyed scene from a table such as funding or friday. */
export function scene(ctx: StageCtx, steps: DialogueStep[] | undefined, onDone: () => void): void {
  if (!steps || steps.length === 0) {
    onDone();
    return;
  }
  dialogue(ctx, steps, onDone);
}
