import { describe, expect, it } from 'vitest';
import type { VoiceLine } from '../content/vo';
import type { Content } from '../sim/content';
import type { ThreadRecord } from '../sim/types';
import { threadLines } from './threadLines';

const say = (id: string): VoiceLine => ({ id, voice: 'narrator', text: id }) as VoiceLine;

describe('the lines a thread speaks', () => {
  const vignettes: Record<string, VoiceLine[]> = { a: [say('a1'), say('a2')], b: [say('b1')] };
  const content = { vignette: (id: string) => (vignettes[id] ? { comments: vignettes[id]!.map((line) => ({ line })) } : undefined) } as unknown as Content;
  const thread = (extra: Partial<ThreadRecord>): ThreadRecord =>
    ({ channel: 'x', title: '', body: '', opVotes: 0, awards: [], vignettes: [{ id: 'a' }, { id: 'b' }], ...extra }) as unknown as ThreadRecord;

  it('come in the order the thread shows them, the mod notice and the edit last', () => {
    const lines = threadLines(content, thread({ mod: say('mod'), edit: say('edit') }));
    expect(lines.map((l) => l.id)).toEqual(['a1', 'a2', 'b1', 'mod', 'edit']);
  });

  it('leave out a notice and an edit that were never written, and a reply chain the content no longer has', () => {
    const lines = threadLines(content, thread({ vignettes: [{ id: 'gone' }, { id: 'b' }] as ThreadRecord['vignettes'] }));
    expect(lines.map((l) => l.id)).toEqual(['b1']);
  });
});
