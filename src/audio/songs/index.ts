import type { MusicId } from '../ids';
import type { Song } from '../sequencer';
import { awards } from './awards';
import { crunch } from './crunch';
import { launch } from './launch';
import { lose } from './lose';
import { menu } from './menu';
import { office } from './office';
import { shop } from './shop';
import { thread } from './thread';
import { title } from './title';
import { win } from './win';

/** Every song in the game, compiled once at load. A missing id is a type error. */
export const SONGS: Readonly<Record<MusicId, Song>> = {
  title,
  office,
  crunch,
  thread,
  launch,
  awards,
  shop,
  win,
  lose,
  menu,
};
