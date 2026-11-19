import type { MusicId } from '../ids';
import type { Song } from '../sequencer';

/**
 * Every song, keyed by id. Songs are added one file at a time; ids without a
 * song yet stay quiet (the engine ignores them).
 */
export const SONGS: Readonly<Partial<Record<MusicId, Song>>> = {};
