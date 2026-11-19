import type { LayerSpec } from '../synth/voice';

/** A bell: a sine with two inharmonic partials. Cash register dings, sparkles, awards. */
export const BELL: readonly LayerSpec[] = [{ wave: 'sine' }, { wave: 'sine', ratio: 2.4, vol: 0.45 }, { wave: 'sine', ratio: 4.1, vol: 0.15 }];

/** A rounder, friendlier chime: harmonic partials only, so it never rings metallic. Praise, hello, hugs. */
export const CHIME: readonly LayerSpec[] = [{ wave: 'sine' }, { wave: 'sine', ratio: 2, vol: 0.3 }, { wave: 'sine', ratio: 3, vol: 0.1 }];
