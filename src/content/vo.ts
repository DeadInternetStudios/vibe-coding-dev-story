/**
 * Voiced lines. Every spoken line in the game is made with `vo()`. The id is a
 * hash of voice + text + delivery (see docs/voice-contract.md), so editing a
 * line retires its old audio and the voice pipeline renders the new one.
 */

export const VOICES = [
  'clod', // your AI pair programmer, sunny and agreeable
  'chad', // co-founder and CEO, visionary bro
  'dave', // senior dev, tired
  'jenny', // intern, anxious
  'automod', // the moderator bot
  'announcer', // awards show and arena announcer
  'narrator', // nature documentary narrator
  'vc', // venture capitalist
  'karen', // entitled customer
  'bro', // crypto and hustle bro
  'pedant', // well actually
  'doomer', // the AI will take our jobs
  'linkedin', // thrilled and humbled
  'arch', // i use arch btw
  'ghost', // the stack overflow ghost
  'duck', // rubber duck
  'hacker', // hooded hacker
  'wholesome', // wholesome redditor
  'grandma', // grandma discovers vibe coding
  'kid', // ten year old game maker
] as const;

export type VoiceId = (typeof VOICES)[number];

export interface VoiceLine {
  readonly kind: 'vo';
  /** `<voice>-<8 hex>`, the name of the MP3 and the manifest key */
  readonly id: string;
  readonly voice: VoiceId;
  /** exactly what is spoken, and what the subtitle shows */
  readonly text: string;
  /** optional acting note for the voice model, for example "whispering, scared" */
  readonly delivery?: string;
}

/** FNV-1a 32 bit over UTF-8 bytes, 8 lowercase hex digits. Same on the Python side. */
export function fnv1a32hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function voiceLineId(voice: VoiceId, text: string, delivery?: string): string {
  return `${voice}-${fnv1a32hex(`${voice}|${text}|${delivery ?? ''}`)}`;
}

/** Make a voiced line. Keep it short, one breath, 4 to 20 words is the sweet spot. */
export function vo(voice: VoiceId, text: string, delivery?: string): VoiceLine {
  const line: VoiceLine = { kind: 'vo', id: voiceLineId(voice, text, delivery), voice, text, ...(delivery ? { delivery } : {}) };
  return Object.freeze(line);
}

export function isVoiceLine(x: unknown): x is VoiceLine {
  return typeof x === 'object' && x !== null && (x as { kind?: unknown }).kind === 'vo' && typeof (x as { id?: unknown }).id === 'string';
}
