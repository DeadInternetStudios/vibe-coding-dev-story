import { app } from '../core/app';
import type { DialogueStep } from '../content/types';
import { dialogue } from './dialogue';
import type { StageCtx } from './ctx';

/** The first-run hints that wait between the opening scene and the first project. */
const FIRST_MINUTE = ['welcome', 'idea'];

/**
 * The opening scene. Plays the intro, then the welcome tip, then hands control back.
 * Whoever skips the intro wants to play, so the first-run hints that would come before the project wizard are not forced on them.
 */
export function showIntro(ctx: StageCtx, onDone: () => void): void {
  dialogue(ctx, app.content.story.intro, (skipped) => {
    const seen = ctx.session.s.tutorial;
    if (skipped) for (const key of FIRST_MINUTE) if (!seen.includes(key)) seen.push(key);
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
