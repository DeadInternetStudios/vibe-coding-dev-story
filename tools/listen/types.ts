/**
 * Types shared by the build script (build.ts, tiers.ts) and the page script (page.ts, model.ts).
 * Types only: nothing in this file runs.
 */

export type TierId = 'A' | 'B' | 'C';

/** One voiced clip as the page needs it. Short keys keep the embedded JSON small. */
export interface Clip {
  /** the manifest key, `<voice>-<8 hex>` */
  readonly id: string;
  /** voice id */
  readonly v: string;
  /** exactly what is said */
  readonly t: string;
  /** file name next to manifest.json, left out when it is `<id>.mp3` */
  readonly f?: string;
  /** duration in seconds */
  readonly d: number;
  /** loudness envelope, 20 hex digits per second, `f` is the loudest moment of this clip */
  readonly e: string;
  /** word timings, flat: start0, end0, start1, end1, ... one pair per whitespace separated word. Left out when the manifest has none. */
  readonly w?: readonly number[];
  /** audio revision: 8 hex digits of the MP3's content hash. It changes when the clip is rendered again. */
  readonly r: string;
  /** set only when the build was asked to keep clips the game never plays (audition takes, reworded lines) */
  readonly u?: true;
}

export interface VoiceInfo {
  readonly id: string;
  /** what the manifest calls the voice */
  readonly name: string;
  readonly role: string;
  /** what the voice is meant to sound like, from tools/tts/voices.json */
  readonly description: string;
  /** clips of this voice on the page */
  readonly clips: number;
  readonly seconds: number;
}

/** A named run of clips: one story beat in Tier B. */
export interface BeatGroup {
  readonly label: string;
  readonly ids: readonly string[];
}

export interface TierData {
  readonly id: TierId;
  readonly title: string;
  readonly blurb: string;
  /** clip ids in display order. A: by voice, B: in story order, C: by voice then text. */
  readonly ids: readonly string[];
  /** Tier B only: the story beats in order. Empty for A and C. */
  readonly groups: readonly BeatGroup[];
}

export interface PageData {
  readonly format: 1;
  readonly manifestVersion: number;
  /** 8 hex digits over everything above and below, so two builds of the same input are recognisably the same */
  readonly build: string;
  /** where the MP3s live, relative to docs/listening-pass.html */
  readonly audioBase: string;
  /** every voice, most clips first */
  readonly voices: readonly VoiceInfo[];
  /** every clip on the page, by id. Clips in the manifest that the game never plays are left out unless asked for. */
  readonly clips: readonly Clip[];
  /** manifest clips that are not on the page because the game never plays them */
  readonly leftOut: number;
  readonly tiers: { readonly A: TierData; readonly B: TierData; readonly C: TierData };
  /** share of Tier C that must be marked before the sign-off appears */
  readonly cShare: number;
  readonly seed: string;
  readonly sampleRate: number;
}
