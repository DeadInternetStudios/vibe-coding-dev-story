import { describe, expect, it } from 'vitest';
import { aboutRows, voiceNote } from './aboutText';

describe('what ABOUT says about the voices', () => {
  // "A machine checked every clip" alone let a player think a person had listened too
  it('says that no person has heard them all while nobody has', () => {
    expect(voiceNote(null)).toMatch(/machine checked/i);
    expect(voiceNote(null)).toMatch(/no person has heard them all/i);
  });

  it('names who heard them once someone has, and stops saying nobody did', () => {
    expect(voiceNote('Sam')).toMatch(/Sam has heard them/);
    expect(voiceNote('Sam')).not.toMatch(/no person/i);
  });

  it('puts the note in the AI VOICES row, with the way to turn them down', () => {
    const row = aboutRows(null).find(([name]) => name === 'AI VOICES');
    expect(row?.[1]).toContain(voiceNote(null));
    expect(row?.[1]).toMatch(/Turn AI VOICES down in Settings/);
  });
});
