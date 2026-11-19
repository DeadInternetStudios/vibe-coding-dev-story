import type { VoiceLine } from '../content/vo';
import type { Content } from '../sim/content';
import type { ThreadRecord } from '../sim/types';

/** Every line a thread speaks, in the order it speaks them: the comments of each reply chain, then the mod notice and the founder's edit. */
export function threadLines(content: Content, thread: ThreadRecord): VoiceLine[] {
  const lines = thread.vignettes.flatMap((rec) => content.vignette(rec.id)?.comments.map((c) => c.line) ?? []);
  if (thread.mod) lines.push(thread.mod);
  if (thread.edit) lines.push(thread.edit);
  return lines;
}
