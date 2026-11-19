import type { MusicId } from '../ids';
import type { Song } from '../sequencer';
import { office } from './office';

/** Every song in the game, compiled once at load. */
export const SONGS: Readonly<Partial<Record<MusicId, Song>>> = {
  office,
};
