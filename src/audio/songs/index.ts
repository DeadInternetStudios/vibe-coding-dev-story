import type { MusicId } from '../ids';
import type { Song } from '../sequencer';
import { lose } from './lose';
import { office } from './office';
import { thread } from './thread';
import { title } from './title';
import { win } from './win';

/** Every song in the game, compiled once at load. */
export const SONGS: Readonly<Partial<Record<MusicId, Song>>> = {
  title,
  office,
  thread,
  lose,
  win,
};
