import type { MusicId } from '../ids';
import type { Song } from '../sequencer';
import { office } from './office';
import { thread } from './thread';
import { title } from './title';

/** Every song in the game, compiled once at load. */
export const SONGS: Readonly<Partial<Record<MusicId, Song>>> = {
  title,
  office,
  thread,
};
