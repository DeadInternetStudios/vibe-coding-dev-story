# Audio notes

Everything that is not a voice: a small live chiptune engine in WebAudio, 55 sound effects and 10
songs. This file is for whoever wires it into the game and whoever tunes it next. The tables
marked AUTO are written by tools from real renders; do not edit them by hand.

Nobody on the build could listen. Every claim about sound below is a number or a picture:
loudness, peaks, spectra, piano rolls, and a comparison between two audio stacks. Read
"Known weak spots" before trusting taste.

## 1. What is where

```
src/audio/
  engine.ts      SoundEngine, the whole public surface
  ids.ts         SfxId, MusicId, labels and families
  index.ts       what the game imports
  levels.ts      loudness trim per sound, written by tools/audio/calibrate.ts (do not edit by hand)
  sequencer.ts   song types and the look-ahead step sequencer (pure, no WebAudio)
  player.ts      plays one song: layers, fades, notes to voices
  synth/         voice (oscillators, noise, envelope, filter), drums, wave tables, master chain
  sfx/           every sound effect as data
  songs/         every song as data, written in a compact notation (songs/dsl.ts)
  *.test.ts      vitest
tools/audio/     offline rendering, measuring, calibration, audition page (nothing here makes sound)
```

Nothing under `src/audio` imports node or the tools, so Vite bundles it as is. Tests and tools
render with `OfflineAudioContext` (node-web-audio-api in node, Chromium for the reference).

## 2. Using it

```ts
import { SoundEngine } from './audio';

const ctx = new AudioContext();
const sound = new SoundEngine(ctx, ctx.destination);

// on the first click or key press (browsers keep the context suspended until then)
await sound.resume();

sound.music('office');
sound.sfx('click');
```

Public surface, exactly:

```ts
class SoundEngine {
  constructor(ctx: AudioContext, out: AudioNode, opts?: EngineOptions); // opts is for tools and tests
  resume(): Promise<void>;
  setVolumes(v: { master?: number; music?: number; sfx?: number }): void; // 0..1, sliders are squared
  setMuted(m: boolean): void;
  sfx(id: SfxId, opts?: { volume?: number; rate?: number; pan?: number }): void;
  music(id: MusicId, opts?: { fadeMs?: number; intensity?: number }): void;
  stopMusic(fadeMs?: number): void;            // default 400
  setIntensity(n: number): void;               // 0..1, layers change at the next bar line
  setTempoScale(n: number): void;              // 0.5..2, stays set
  duck(amount: number, ms: number): void;      // amount 0..1 is how much of the music to cut
  unduck(ms: number): void;
  currentMusic(): MusicId | null;
  static readonly SFX: readonly { id: SfxId; label: string; family: string }[];
  static readonly MUSIC: readonly { id: MusicId; label: string; layers: string[] }[];
}
export type SfxId = /* 55 ids, section 3 */;
export type MusicId = /* 10 ids, section 3 */;
```

Behaviour you can rely on:

- Nothing throws, whatever it is asked: bad ids, NaN, calls after `dispose()`, hundreds of calls in a row.
- Before the context is running a sound effect is dropped and `music()` is remembered and starts
  when the context runs. `resume()` always resolves; if the browser leaves its own promise
  pending (autoplay policy), it stops waiting after 1 s.
- Asking for the song that is already playing only changes its intensity.
- A sound that is triggered again within its cooldown (20 ms unless the sound says otherwise) is
  skipped, so a held key does not make a wall of clicks. Two sounds climb when repeated quickly:
  `upvote` walks up a pentatonic scale (runs within 0.6 s), `karma_tick` steps up a fifth (runs
  within 0.25 s). Most sounds carry a little random detune (`jitter`) so repeats are not identical.
- `rate` speeds a sound up (pitch and length together), `pan` is -1 to 1, `volume` is a linear
  multiplier from 0 to 2.
- Songs crossfade in 500 ms over another song, 150 ms from silence (`fadeMs` overrides).
- At most 44 voices sound at once. Every music note and every kick and snare always sounds; sound
  effect voices and the other drums are dropped when 44 are already sounding at that moment.
- While a voice line plays, for example `duck(0.6, 120)` when it starts and `unduck(400)` when it ends.
- `win` and `lose` play once and end. The other eight loop forever.

`tools/audio/room.html` is an audition page (every sound and song as a button). It makes sound
only after you press Start, so open it yourself with the Vite dev server:
`npm run dev`, then `/tools/audio/room.html`.

## 3. Ids

<!-- AUTO:BEGIN ids -->
**Sound effects (55)**

| Family | Count | Ids |
|---|---|---|
| ui | 13 | `click`, `hover`, `back`, `open`, `close`, `tab`, `toggle`, `error`, `confirm`, `deny`, `select`, `type`, `type2` |
| money | 6 | `coin`, `coins`, `cash_register`, `payday`, `bill`, `broke` |
| progress | 7 | `level_up`, `hot_idea`, `bubble`, `phase_done`, `ship_it`, `deploy_beep`, `deploy_go` |
| thread | 9 | `upvote`, `downvote`, `award`, `comment_in`, `karma_tick`, `thread_open`, `removed`, `roast`, `praise` |
| office | 14 | `hire`, `fire`, `coffee`, `pizza`, `phone`, `keyboard_burst`, `rate_limit`, `alert`, `bug`, `fix`, `explosion`, `quack`, `meow`, `ghost` |
| fanfare | 6 | `fanfare_small`, `fanfare_big`, `award_win`, `game_over`, `victory`, `achievement` |

**Music (10)**

A layer plays while the intensity is inside its window; `a-b` means from `a` to `b`, no window means the whole range.

| Id | Label | Song | Layers |
|---|---|---|---|
| `title` | Title screen | 120 BPM, C major, 16 bars, loops | `base`, `perc`, `bass` 0.3-1, `chords` 0.3-1, `kit` 0.3-1, `lead` 0.55-1, `extra` 0.8-1 |
| `office` | Office (cozy) | 104 BPM, F major, 32 bars, loops | `base`, `bass`, `perc`, `pad` 0-0.34, `chords` 0.3-1, `kit` 0.45-1, `lead` 0.45-1, `extra` 0.8-1 |
| `crunch` | Crunch time | 148 BPM, A minor, 32 bars, loops | `base`, `bass`, `perc` 0.2-1, `kit` 0.35-1, `lead` 0.45-1, `chords` 0.5-1, `extra` 0.8-1 |
| `thread` | Reddit thread | 96 BPM, G major, 24 bars, loops | `base`, `bass`, `perc`, `lead` 0.25-1, `kit` 0.55-1, `extra` 0.3-1 |
| `launch` | Launch hype | 132 BPM, D major, 32 bars, loops | `base`, `bass`, `kit` 0.3-1, `chords` 0.45-1, `lead` 0.55-1, `extra` 0.8-1 |
| `awards` | Awards show | 108 BPM, Bb major, 16 bars, loops | `base`, `bass`, `chords` 0.25-1, `lead` 0.3-1, `perc` 0.45-1, `extra` 0.7-1 |
| `shop` | Shopping mall | 112 BPM, Eb major, 24 bars, loops | `base`, `bass`, `perc`, `lead` 0.3-1, `kit` 0.45-1, `extra` 0.6-1 |
| `win` | You win | 132 BPM, A major, 8 bars, plays once | `lead`, `brass`, `base`, `bass`, `kit`, `extra` |
| `lose` | Sad trombone | 100 BPM, G minor, 2 bars, plays once | `lead`, `bass`, `pad`, `perc` |
| `menu` | Menu (calm) | 84 BPM, Ab major, 24 bars, loops | `base`, `pad`, `bass` 0.2-1, `lead` 0.35-1, `perc` 0.5-1, `extra` 0.65-1 |
<!-- AUTO:END ids -->

Where each song is meant to go, and what intensity does to it. `music(id)` with no intensity uses
the default below. At intensity 0 only the quiet floor plays; each higher layer joins inside its
window (the table above) at the next bar line.

| Song | Use it for | Default intensity | Quiet floor (intensity 0) | Length |
|---|---|---|---|---|
| `title` | title screen | 1 | `base`, `perc` | 32 s loop |
| `office` | the studio day to day; raise intensity as pressure builds | 0.5 | `base`, `bass`, `perc`, `pad` | 73.8 s loop |
| `crunch` | deadline weeks; run the intensity up as the deadline nears | 0.7 | `base`, `bass` | 51.9 s loop |
| `thread` | the fake Reddit thread; plays under the voice, so `duck()` it only a little | 0.4 | `base`, `bass`, `perc` | 60 s loop |
| `launch` | launch day hype | 0.7 | `base`, `bass` | 58.2 s loop |
| `awards` | the awards show | 0.6 | `base`, `bass` | 35.6 s loop |
| `shop` | the shopping screen | 0.55 | `base`, `bass`, `perc` | 51.4 s loop |
| `win` | you win; plays once, then `currentMusic()` is `null` | 1 | whole piece | 14.5 s |
| `lose` | sad trombone; plays once | 1 | whole piece | 3.6 s |
| `menu` | settings and other calm screens | 0.55 | `base`, `pad` | 68.6 s loop |

## 4. How loud things are

Targets, measured on Chromium's `OfflineAudioContext` (the stack the game ships on):

| Kind | Target | Measured how |
|---|---|---|
| Looping song | -18 LUFS-I | ebur128 over one settled loop |
| Stinger (`win`, `lose`) | -16 LUFS-I | the whole piece |
| Sound effect | -14 LUFS "event" by default | K-weighted loudness of the part that is not silence; quiet sounds (`hover`, `type`, `karma_tick`) have their own lower target |
| Any peak | below -3 dBFS | sample peak of the master output |

The master chain:

```
songs -> duck -> music volume \
                               master -> mute -> high pass 26 Hz -> low pass 8.8 kHz -> limiter -> guard -> out
sound effects -> sfx volume  /
```

- The limiter is a 2x oversampled tanh shoulder: untouched below -6 dBFS, topping out at -3.5 dBFS.
- Oversampling rings after a hard clip (measured +0.4 dB on a loud fanfare, +1.6 dB when 600
  sounds pile up), so a second stage, a plain waveshaper with no oversampling, bounds the output
  at -3.0 dBFS exactly. It does nothing below -3.45 dBFS.
- `tools/audio/stress.ts` plays 600 random sounds over `crunch` at full intensity for 8 s on both
  backends and fails on any sample above -3.0 dBFS.
- Per-sound trims are in `levels.ts`. `tools/audio/calibrate.ts` writes them from measured
  renders. It will not push a sound past a peak cap (-3.8 dBFS for sounds), and will not raise a
  song when 5% of its frames would then reach into the limiter's knee. That is why `crunch` and
  `thread` sit a little under -18.

Reading the spectrograms: the bottom band (50 to 150 Hz) lights up under almost every sound. That
is leakage from the lowest FFT bins on a log axis. Measured energy below 150 Hz is -52 to -75 dB
of the total for `confirm`, `select`, `coin`, `toggle`, `open`, `hover` and `payday`. Sounds that
are low on purpose (`deny`, `error`, `bill`, `broke`, `ship_it`) really do carry most of their
energy under 300 Hz. Vertical banding on dense songs is moire between the beat grid and the
pixel columns.

## 5. Measured results

Songs and sound effects, Chromium renders (the reference). Flags: `LUFS` more than 2 LU (songs) or
2.5 LU (sounds) from its own target, `TEMPO`, `KEY`, `SEAM` (a click at the loop point), `LOOP`
(loop 2 does not match loop 1), `GAP` (more than 150 ms of digital silence in the middle), `HARSH`,
`LATE`, `DC`, `CLIP`, `PEAK`. "found" tempo and key come from analysis and are approximate: the
chroma key finder confuses related keys (the declared key is usually in its top three, `thread`'s
only at rank 7) and a half-time or double-time song reads as the other tempo, so the declared
values are checked against the song data by tests instead.

The loop seam columns: `Seam click x` is the biggest sample-to-sample step at the loop point divided
by what the rest of the loop reaches (the 99th percentile of the biggest step in each 4 ms window).
A click would be well above 1; the flag is 1.5. `Seam dB`
is the loudness of the 50 ms after the loop point minus the 50 ms before it, and `Bar line dB` is
the same step at an ordinary bar line, median over the song. Music has a small rest before each
downbeat, so what matters is that the two agree. They do within 2.4 dB for every looping song
except `title`: its loop point steps 20.6 dB against 11.1 at a bar line. The cause is that the last
20 ms before the loop point decays to -53 dB where an ordinary bar line stays near -30 dB, a rest
of about 15 ms in a busy 16th note arrangement. No click, nowhere near the 150 ms gap flag, and
probably inaudible, but it is the seam to listen to first. `Loop corr` compares the 10 ms
loudness envelope of loop 2 with loop 1.

<!-- AUTO:BEGIN music -->
| Song | BPM set/found | Key set/found | Bars | Loop s | LUFS-I | LUFS loop | Peak dBFS | TP dBTP | Centroid Hz | Roll-off 95% | Seam click x | Seam dB | Bar line dB | Loop corr | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| awards | 108/108 (ok) | Bb major/F major (top3) | 16 | 35.6 | -18.0 | -18.0 | -3.4 | -3.4 | 1103 | 3117 | 0.15 | +7.9 | +10.0 | 0.978 | ok |
| crunch | 148/74 (x0.5) | A minor/A minor (ok) | 32 | 51.9 | -18.5 | -18.5 | -3.4 | -3.3 | 1535 | 6352 | 0.17 | +9.7 | +12.1 | 0.959 | ok |
| launch | 132/132 (ok) | D major/A major (top3) | 32 | 58.2 | -18.1 | -18.1 | -3.7 | -3.6 | 1335 | 5273 | 0.28 | +9.1 | +11.5 | 0.985 | ok |
| lose | 100/101 (short) | G minor/D minor (short) | 2 | 3.6 | -16.0 | - | -6.0 | -6.0 | 299 | 1008 | - | - | - | - | ok |
| menu | 84/168 (x2) | Ab major/D# major (top3) | 24 | 68.6 | -18.0 | -18.0 | -5.7 | -5.7 | 499 | 1055 | 0.11 | +8.9 | +6.6 | 0.969 | ok |
| office | 104/104 (ok) | F major/F major (ok) | 32 | 73.8 | -18.0 | -18.0 | -3.5 | -3.5 | 1160 | 5273 | 0.02 | +14.5 | +12.2 | 0.983 | ok |
| shop | 112/112 (ok) | Eb major/A# major (top3) | 24 | 51.4 | -18.0 | -18.0 | -3.5 | -3.5 | 914 | 3141 | 0.03 | +12.9 | +12.7 | 0.974 | ok |
| thread | 96/96 (ok) | G major/E major (rank 7) | 24 | 60.0 | -19.6 | -19.6 | -3.5 | -3.4 | 858 | 3516 | 0.00 | +50.5 | +50.5 | 1.000 | ok |
| title | 120/120 (ok) | C major/C major (ok) | 16 | 32.0 | -18.1 | -18.1 | -3.4 | -3.3 | 1239 | 5391 | 0.01 | +20.6 | +11.1 | 1.000 | ok |
| win | 132/132 (ok) | A major/A major (ok) | 8 | 14.5 | -16.1 | - | -3.6 | -3.5 | 1195 | 4711 | - | - | - | - | ok |
<!-- AUTO:END music -->

<!-- AUTO:BEGIN sfx -->
| ID | Family | Dur s | Peak dBFS | LUFS-event | Centroid Hz | Roll-off 95% | >6 kHz % | DC | Flags |
|---|---|---|---|---|---|---|---|---|---|
| achievement | fanfare | 1.03 | -4.7 | -14.0 | 1602 | 4406 | 3.3 | 0.0000 | ok |
| alert | office | 0.68 | -6.8 | -14.0 | 1842 | 5297 | 3.6 | 0.0000 | ok |
| award | thread | 0.79 | -3.9 | -13.9 | 2072 | 4734 | 2.6 | 0.0000 | ok |
| award_win | fanfare | 3.24 | -3.5 | -14.8 | 1050 | 5062 | 3.7 | 0.0000 | ok |
| back | ui | 0.18 | -8.9 | -16.0 | 1007 | 3328 | 1.9 | 0.0000 | ok |
| bill | money | 0.49 | -5.5 | -14.1 | 442 | 1500 | 0.6 | 0.0000 | ok |
| broke | money | 1.22 | -4.3 | -14.0 | 616 | 2250 | 1.2 | 0.0000 | ok |
| bubble | progress | 0.15 | -8.8 | -17.0 | 640 | 1031 | 0.0 | 0.0000 | ok |
| bug | office | 0.43 | -6.7 | -14.1 | 542 | 1453 | 0.0 | 0.0000 | ok |
| cash_register | money | 0.50 | -3.5 | -14.2 | 1816 | 3797 | 2.3 | 0.0000 | ok |
| click | ui | 0.03 | -6.7 | -16.9 | 1967 | 6375 | 7.9 | 0.0000 | ok |
| close | ui | 0.11 | -8.6 | -17.1 | 740 | 891 | 0.1 | 0.0000 | ok |
| coffee | office | 0.47 | -4.5 | -14.0 | 1513 | 3328 | 0.5 | 0.0000 | ok |
| coin | money | 0.47 | -6.1 | -14.0 | 1874 | 6609 | 5.7 | 0.0000 | ok |
| coins | money | 0.87 | -6.0 | -15.0 | 2814 | 7922 | 9.5 | 0.0000 | ok |
| comment_in | thread | 0.18 | -8.1 | -17.1 | 1402 | 4453 | 3.5 | 0.0000 | ok |
| confirm | ui | 0.30 | -5.5 | -14.0 | 1702 | 5859 | 3.0 | 0.0000 | ok |
| deny | ui | 0.25 | -4.8 | -14.0 | 721 | 2578 | 1.4 | 0.0000 | ok |
| deploy_beep | progress | 0.05 | -13.6 | -18.0 | 2016 | 6609 | 6.7 | 0.0000 | ok |
| deploy_go | progress | 0.62 | -3.8 | -15.0 | 1264 | 4219 | 3.6 | 0.0000 | ok |
| downvote | thread | 0.20 | -4.3 | -14.1 | 507 | 1453 | 0.8 | 0.0000 | ok |
| error | ui | 0.39 | -4.4 | -14.0 | 526 | 1781 | 0.9 | 0.0000 | ok |
| explosion | office | 0.83 | -3.6 | -13.8 | 754 | 3234 | 0.2 | 0.0000 | ok |
| fanfare_big | fanfare | 3.12 | -3.5 | -14.7 | 915 | 4969 | 3.3 | 0.0000 | ok |
| fanfare_small | fanfare | 1.59 | -3.4 | -14.3 | 1341 | 6234 | 5.2 | 0.0000 | ok |
| fire | office | 1.22 | -3.8 | -14.1 | 263 | 938 | 0.0 | 0.0000 | ok |
| fix | office | 0.65 | -3.9 | -14.1 | 1868 | 4969 | 3.8 | 0.0000 | ok |
| game_over | fanfare | 2.19 | -4.0 | -14.2 | 453 | 1359 | 0.5 | 0.0000 | ok |
| ghost | office | 1.42 | -7.0 | -14.0 | 549 | 703 | 0.0 | 0.0000 | ok |
| hire | office | 0.49 | -5.1 | -14.1 | 2125 | 6609 | 5.8 | 0.0000 | ok |
| hot_idea | progress | 0.49 | -4.0 | -14.2 | 2162 | 4266 | 2.8 | 0.0000 | ok |
| hover | ui | 0.01 | -11.3 | -23.0 | 1866 | 2297 | 2.2 | 0.0000 | ok |
| karma_tick | thread | 0.02 | -13.3 | -22.0 | 2065 | 2156 | 1.0 | 0.0000 | ok |
| keyboard_burst | office | 0.65 | -4.0 | -17.9 | 657 | 1125 | 0.2 | 0.0000 | ok |
| level_up | progress | 0.97 | -3.7 | -14.7 | 2094 | 6281 | 5.7 | 0.0000 | ok |
| meow | office | 0.49 | -8.6 | -14.1 | 1350 | 2391 | 0.1 | 0.0000 | ok |
| open | ui | 0.13 | -8.6 | -17.1 | 515 | 844 | 0.3 | 0.0000 | ok |
| payday | money | 0.94 | -3.9 | -14.8 | 1744 | 4734 | 3.9 | 0.0000 | ok |
| phase_done | progress | 0.49 | -5.0 | -14.0 | 2071 | 5953 | 4.8 | 0.0000 | ok |
| phone | office | 0.85 | -12.6 | -16.0 | 1262 | 4406 | 2.6 | 0.0000 | ok |
| pizza | office | 0.80 | -3.9 | -14.2 | 1829 | 6047 | 5.0 | 0.0000 | ok |
| praise | thread | 0.83 | -5.7 | -14.1 | 1051 | 2062 | 0.1 | 0.0000 | ok |
| quack | office | 0.21 | -5.9 | -14.0 | 1019 | 1641 | 0.0 | 0.0000 | ok |
| rate_limit | office | 0.85 | -4.0 | -14.1 | 917 | 3141 | 1.8 | 0.0000 | ok |
| removed | thread | 0.41 | -3.5 | -14.1 | 326 | 1031 | 0.0 | 0.0001 | ok |
| roast | thread | 0.46 | -3.4 | -13.9 | 1684 | 7078 | 9.5 | 0.0000 | ok |
| select | ui | 0.09 | -4.5 | -16.0 | 2166 | 6328 | 8.8 | 0.0000 | ok |
| ship_it | progress | 1.50 | -3.4 | -14.7 | 1092 | 5250 | 4.0 | 0.0000 | ok |
| tab | ui | 0.03 | -4.1 | -17.9 | 1113 | 2438 | 1.5 | 0.0000 | ok |
| thread_open | thread | 0.46 | -5.8 | -14.0 | 1599 | 5859 | 3.1 | 0.0000 | ok |
| toggle | ui | 0.09 | -10.4 | -17.1 | 2063 | 5297 | 4.6 | 0.0000 | ok |
| type | ui | 0.01 | -10.9 | -21.0 | 1615 | 6141 | 6.1 | 0.0000 | ok |
| type2 | ui | 0.02 | -10.4 | -21.0 | 928 | 2812 | 0.6 | 0.0000 | ok |
| upvote | thread | 0.24 | -4.0 | -14.0 | 2106 | 7031 | 6.3 | 0.0000 | ok |
| victory | fanfare | 3.03 | -3.5 | -14.1 | 1040 | 5203 | 3.6 | 0.0000 | ok |
<!-- AUTO:END sfx -->

Layer balance inside each song (node renders; the ratios do not depend on the backend). Each
layer is rendered alone and compared with the lead; `change vol by` is the factor
`tools/audio/rebalance.ts` applies to the layer's `vol` in the song source. After a rebalance every
factor is close to x1.00.

<!-- AUTO:BEGIN layers -->
| Song | Layer alone | LUFS-I | Peak dBFS | vs lead dB | wanted vs lead | change vol by |
|---|---|---|---|---|---|---|
| awards | base | -26.6 | -16.9 | -6.0 | -6.0 | x1.00 |
| awards | bass | -23.5 | -11.5 | -2.9 | -3.0 | x0.99 |
| awards | chords | -26.7 | -3.7 | -6.1 | -6.0 | x1.01 |
| awards | extra | -29.6 | -13.3 | -9.0 | -9.0 | x1.00 |
| awards | lead | -20.6 | -15.1 | +0.0 | +0.0 | x1.00 |
| awards | perc | -28.8 | -10.4 | -8.2 | -9.0 | x0.91 |
| crunch | base | -29.0 | -15.0 | -6.2 | -6.0 | x1.02 |
| crunch | bass | -25.8 | -16.1 | -3.0 | -3.0 | x1.00 |
| crunch | chords | -28.8 | -5.6 | -6.0 | -6.0 | x1.00 |
| crunch | extra | -31.8 | -7.3 | -9.0 | -9.0 | x1.00 |
| crunch | kit | -26.5 | -7.5 | -3.7 | -4.0 | x0.97 |
| crunch | lead | -22.8 | -16.5 | +0.0 | +0.0 | x1.00 |
| crunch | perc | -32.0 | -11.3 | -9.2 | -9.0 | x1.02 |
| launch | base | -28.4 | -18.2 | -6.0 | -6.0 | x1.00 |
| launch | bass | -25.4 | -15.5 | -3.0 | -3.0 | x1.00 |
| launch | chords | -28.4 | -12.5 | -6.0 | -6.0 | x1.00 |
| launch | extra | -31.4 | -14.2 | -9.0 | -9.0 | x1.00 |
| launch | kit | -26.1 | -6.2 | -3.7 | -4.0 | x0.97 |
| launch | lead | -22.4 | -16.1 | +0.0 | +0.0 | x1.00 |
| lose | bass | -22.0 | -16.3 | -2.9 | -3.0 | x0.99 |
| lose | lead | -19.1 | -10.0 | +0.0 | +0.0 | x1.00 |
| lose | pad | -22.2 | -13.5 | -3.1 | -3.0 | x1.01 |
| lose | perc | -28.0 | -10.8 | -8.9 | -9.0 | x0.99 |
| menu | base | -27.8 | -15.8 | -6.0 | -6.0 | x1.00 |
| menu | bass | -24.8 | -19.2 | -3.0 | -3.0 | x1.00 |
| menu | extra | -30.9 | -14.9 | -9.1 | -9.0 | x1.01 |
| menu | lead | -21.8 | -18.7 | +0.0 | +0.0 | x1.00 |
| menu | pad | -24.8 | -13.8 | -3.0 | -3.0 | x1.00 |
| menu | perc | -31.0 | -9.9 | -9.2 | -9.0 | x1.02 |
| office | base | -28.0 | -17.5 | -6.0 | -6.0 | x1.00 |
| office | bass | -24.9 | -13.9 | -2.9 | -3.0 | x0.99 |
| office | chords | -28.0 | -10.6 | -6.0 | -6.0 | x1.00 |
| office | extra | -31.0 | -13.7 | -9.0 | -9.0 | x1.00 |
| office | kit | -25.8 | -3.9 | -3.8 | -4.0 | x0.98 |
| office | lead | -22.0 | -15.6 | +0.0 | +0.0 | x1.00 |
| office | pad | -25.0 | -14.6 | -3.0 | -3.0 | x1.00 |
| office | perc | -31.1 | -11.9 | -9.1 | -9.0 | x1.01 |
| shop | base | -27.1 | -6.1 | -6.0 | -6.0 | x1.00 |
| shop | bass | -24.1 | -11.7 | -3.0 | -3.0 | x1.00 |
| shop | extra | -30.2 | -11.6 | -9.1 | -9.0 | x1.01 |
| shop | kit | -25.2 | -8.9 | -4.1 | -4.0 | x1.01 |
| shop | lead | -21.1 | -18.2 | +0.0 | +0.0 | x1.00 |
| shop | perc | -30.0 | -12.5 | -8.9 | -9.0 | x0.99 |
| thread | base | -27.5 | -6.6 | -6.0 | -6.0 | x1.00 |
| thread | bass | -24.5 | -10.9 | -3.0 | -3.0 | x1.00 |
| thread | extra | -30.5 | -27.0 | -9.0 | -9.0 | x1.00 |
| thread | kit | -25.7 | -8.5 | -4.2 | -4.0 | x1.02 |
| thread | lead | -21.5 | -4.8 | +0.0 | +0.0 | x1.00 |
| thread | perc | -30.5 | -9.0 | -9.0 | -9.0 | x1.00 |
| title | base | -28.5 | -16.8 | -6.0 | -6.0 | x1.00 |
| title | bass | -25.5 | -15.1 | -3.0 | -3.0 | x1.00 |
| title | chords | -28.5 | -4.8 | -6.0 | -6.0 | x1.00 |
| title | extra | -31.5 | -14.6 | -9.0 | -9.0 | x1.00 |
| title | kit | -26.5 | -5.3 | -4.0 | -4.0 | x1.00 |
| title | lead | -22.5 | -15.0 | +0.0 | +0.0 | x1.00 |
| title | perc | -31.4 | -13.5 | -8.9 | -9.0 | x0.99 |
| win | base | -26.1 | -15.9 | -6.0 | -6.0 | x1.00 |
| win | bass | -23.1 | -13.4 | -3.0 | -3.0 | x1.00 |
| win | brass | -25.9 | -14.8 | -5.8 | - |  |
| win | extra | -29.1 | -12.4 | -9.0 | -9.0 | x1.00 |
| win | kit | -24.1 | -4.8 | -4.0 | -4.0 | x1.00 |
| win | lead | -20.1 | -12.5 | +0.0 | +0.0 | x1.00 |
<!-- AUTO:END layers -->

## 6. Things the backends do differently

Both found while chasing a number that would not agree. Both are fixed in the engine and guarded
by a test, because the unit tests run on node and cannot see a browser.

**node-web-audio-api ignores `disableNormalization`.** A browser plays a custom `PeriodicWave` at
the level its Fourier series says; node peak-normalizes every one to 1.0 even when told not to
(`tools/audio/waveprobe.ts`). A pulse with a duty other than 50% therefore played at a different
level in each. Before the fix `p50` was 4.6 dB louder in node than in Chromium, `p12` 3.3 dB
quieter, `warm` 2.4, `tri4` 1.6, `organ` 1.5, and every level calibrated in node was wrong for the
real game (`click` measured -17.0 LUFS in node and -21.3 in Chromium). Now every table is built so
its peak is exactly 1 (normalizing it changes nothing) and carries its designed level as an
explicit gain in the voice. After the fix all waves agree between the two backends exactly at
110 Hz and within 0.4 dB at 1760 Hz, where Chromium band-limits the wave.
`src/audio/backend.test.ts` fails if any wave drifts from its designed level.

**A browser starts an oscillator's phase from where the note falls in the render quantum when its
frequency is automated.** `tools/audio/startprobe.ts` starts a 1 kHz oscillator at many fractional
sample positions:

| Pitch set by | node | Chromium |
|---|---|---|
| `frequency.value` | 0.32 samples worst | 0.00 |
| `frequency.setValueAtTime` | 0.32 | 23.44 (half a cycle) |
| `setValueAtTime` and a vibrato LFO on `detune` | 0.32 | 23.44 |
| `frequency.value` and a vibrato LFO on `detune` | 0.32 | 0.98 |

Every voice used to anchor its pitch with `setValueAtTime`, so in a browser each note began at a
different phase. A looping song never repeated the same twice (menu: loop envelope correlation
0.88, tonal layers 0.3 to 0.8 waveform correlation between loop 1 and loop 2, where node says
0.998 to 1.000) and short bright sounds had attack peaks that varied by a few dB between plays.
Steady notes, vibrato included, now set `frequency.value`; slides, arpeggios and drum sweeps still
need events. After the fix every tonal layer of `menu` correlates 0.996 to 1.000 between loops on
Chromium, the same as node (the `perc` layer stays lower on both: noise and drum sweeps), and node
and Chromium agree on loudness within 0.18 dB over all 65 sounds
(worst before: 1.16 dB). What is left: a sound built on a slide can still peak up to about 2.6 dB
differently between the two stacks (`downvote`), with the same loudness.
`src/audio/voice.test.ts` fails when a steady note schedules a frequency event.

**node-web-audio-api renders raced their own scheduler.** It hands `suspend()` to a worker thread,
so a suspend registered right before `startRendering()` can land after the renderer has passed its
time and reject with `InvalidStateError`. The harness swallowed that, the engine lost up to 0.5 s of
scheduling, and `win` came out with a 329 ms hole. Measured on a fresh process, 4 of 20 first
renders lost 5 to 48 of 833 pumps. The harness now waits 10 ms after registering (0 of 20 lost),
audits every pump (count and lateness), re-renders a tainted job up to 8 times and then throws.
`src/audio/harness.test.ts` forces the failure. `analyze.py` also flags any hole over 150 ms. Two
renders of the same job differ by float noise only (largest 2.4e-7, about -150 dBFS).

## 7. How to check things

Setup, once: `npm install` (adds `node-web-audio-api`, which only the tools and tests use), then
`python3 -m venv tools/audio/.venv && tools/audio/.venv/bin/pip install -r tools/audio/requirements.txt`.
`ffmpeg` must be on the path (loudness). The Chromium backend reads Playwright and its browser
from `~/.100x` (override with `PLAYWRIGHT_HOME`); it is not a dependency of the repo, and it is
launched muted.

Nothing here can reach a speaker: renders use `OfflineAudioContext` only, in node or in a headless
Chromium started with `--mute-audio`.

```
npx vitest run src/audio                       unit tests (303)
npx tsc --noEmit                               types

npx tsx tools/audio/render.ts sfx click coin   render sounds (or `sfx all`) to tools/audio/out/wav
npx tsx tools/audio/render.ts music office --intensity 1 --loops 2
npx tsx tools/audio/render.ts music office --solo bass,kit      only those layers
  add --backend chromium --out tools/audio/out/chromium         render on Chromium instead of node

tools/audio/.venv/bin/python tools/audio/analyze.py             analyze everything rendered, write the tables above
tools/audio/sfx.sh measure|flagged|calibrate|settle            all sounds, one line each
tools/audio/music.sh measure|calibrate|settle                   all songs
  BACKEND=chromium sets the real levels; node is the quick proxy. PNG=1 also draws spectrograms.
tools/audio/song.sh mix|balance|all <song>                      one song: mix, or every layer alone
npx tsx tools/audio/rebalance.ts <song> [--write]               apply the layer balance to the song source
npx tsx tools/audio/calibrate.ts [--sfx|--music] [--write] [--analysis <analysis.json>]
                                                                write levels.ts (the sh scripts call this)

tools/audio/.venv/bin/python tools/audio/crosscheck.py          node against Chromium, every sound
npx tsx tools/audio/waveprobe.ts                                every wave, node against Chromium
npx tsx tools/audio/startprobe.ts                               oscillator start accuracy
npx tsx tools/audio/stress.ts                                   600 sounds over a full song, peak check
npx tsx tools/audio/cpu.ts                                      cost of each song, both backends
npx tsx tools/audio/roomcheck.ts                                room.html loads, makes no AudioContext
npx tsx tools/audio/ids-doc.ts                                  rewrite the ids block above
```

Tuning a song: edit it under `src/audio/songs`, run `tools/audio/song.sh all <song>`, look at
`tools/audio/out/png/rolls/<song>.png` and the spectrogram, run `rebalance.ts <song> --write` if
the layer table asks for it, then `BACKEND=chromium tools/audio/music.sh settle`.

## 8. Decisions made without asking

- **Chromium is the calibration reference, node is the proxy.** The game runs in a browser.
- **Song notation is text**, one token per 16th step (`songs/dsl.ts` documents it): absolute notes,
  chord tones by number, `@` for a tracker arpeggio, `+` for two at once, `\4` and `/2` for glides
  of 4 down or 2 up. Mistakes in a song name the bar and step. Drum lanes are strings of
  `x X o . -`.
- **Layers by intensity.** Each song has layers that switch on inside an intensity window, change at
  bar lines and have a little hysteresis, so `setIntensity` can follow the game's mood without
  flapping. A song is never silent at any intensity (tested).
- **Songs stay in key** (tested): every note is in the scale, in the chord or declared chromatic, and
  the lead lands on chord tones on strong beats. `lose` is in 3/4 on purpose.
- **Exactly the 55 sound effect ids and 10 song ids the brief lists**, no extras. Ten more (`whoosh`,
  `pop`, `notify`, `rimshot`, `womp`, `drumroll`, `sparkle`, `stamp`, `heart`, `slider`) were
  considered; each needs an entry in `ids.ts`, `sfx/`, `levels.ts` and the tests.
- **The constructor takes an optional third argument** (`EngineOptions`: manual clock, seeded random,
  voice limit, replacement songs). The two argument form in the brief works unchanged.
- **Randomness is seeded in renders** (mulberry32), so a render is reproducible.
- **Sliders are squared** (`volumeToGain`), the usual way to make a slider feel even.
- **Master low pass at 8.8 kHz.** Chip waves have far more top end than anyone wants to hear.

## 9. CPU

`tools/audio/cpu.ts` renders each song's full mix (all layers on) as fast as the machine allows and
reports the cost of one second of music. It counts both the engine's scheduling (JavaScript) and the
browser's graph rendering, which is what a live game pays.

On Chromium every song costs 12 to 22 ms per second of music: 1.2 to 2.2% of one core, worst
`win` at 2.2%. That was measured while the machine's load average was 119 on 10 cores, so it is an
upper bound. node-web-audio-api figures (4 to 68%) are dominated by thread handoffs under that
load and say nothing about the game.

The scheduler wakes every 25 ms and plans 200 ms ahead. A main thread stall under about 200 ms is
covered by what was already scheduled. A stall of 200 to 450 ms plays the late notes in a short
burst. A longer one makes the song resume where it left off rather than catch up (the sequencer
gives up on notes more than 250 ms late).

## 10. Known weak spots

- **Nobody listened.** Pitch, rhythm, balance and loudness were verified by tests, numbers and
  pictures. Whether it is charming is untested. The first thing to do with ears is play every song at
  two intensities and every sound effect once.
- Six sound effects sit up to 1 LU under their target because the -3.8 dBFS peak cap stops the
  calibration raising them: `deploy_go`, `payday`, `award_win`, `fanfare_big`, `ship_it`, `level_up`.
  Nobody will hear 1 LU.
- `crunch` (-18.5) and `thread` (-19.6) sit under -18 because raising them would push 5% of their
  frames into the limiter's knee. `thread` plays under the voice reading a thread, so lower suits it.
- The tempo and key detectors are approximate. `menu` reads as 168 BPM (it is 84) and key finder
  results for `thread` and `menu` are the relative or enharmonic key. The song data and its tests
  are the truth.
- Sounds built on slides, arpeggios and drum sweeps still start at a browser-dependent phase, so a
  peak can differ by a couple of dB between plays. Loudness does not.
- No live browser measurement: all numbers are offline renders on Chromium. The live path (the 25 ms
  timer, the look-ahead, `resume()`, a long stall) is tested against a spoofed clock and fake timers in
  `src/audio/live.test.ts`, not in a running context. The CPU figure in particular should be confirmed
  in the running game with the browser's performance panel.
- Not tested: what the music does when the tab is hidden. The scheduler depends on a 25 ms timer
  and browsers throttle timers in hidden tabs (a tab that is audibly playing is normally exempt).
  Pausing or `stopMusic()` when the page is hidden is the safe choice.
