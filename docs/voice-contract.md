# Voice contract

The game never runs a TTS model. Every spoken line is rendered offline with
Qwen3-TTS-12Hz-1.7B-VoiceDesign on the dev machine, shipped as a small MP3, and
played by the browser. This file is the contract between the content, the
voice pipeline (`tools/tts`) and the game (`src/audio`).

## Line identity

A voiced line is `{ voice, text, delivery? }`.

    id = voice + "-" + hex8(fnv1a32(utf8(voice + "|" + text + "|" + (delivery ?? ""))))

- `fnv1a32`: offset basis 2166136261, prime 16777619, XOR the byte first, then
  multiply, wrap at 2^32. `hex8` is 8 lowercase hex digits, zero padded.
- Test vector: `voice="dave"`, `text="Did anyone actually read the diff?"`,
  no delivery, must give the id `dave-f3434638`. `tools/tts/idtest.py` and
  `npm run vo:idtest` both print it, and the game's tests check it.
- Edit a line's text and its id changes, so old audio is never reused by
  accident and new audio is generated automatically. Never edit ids by hand.

## Files

| Path | Who writes it | What |
|---|---|---|
| `tools/tts/voices.json` | tts pipeline | the cast: voice id -> name, VoiceDesign description, loudness trim |
| `tools/tts/lines.json` | `npm run vo:export` (game side) | every line the game can speak: `{ version: 1, lines: [{ id, voice, text, delivery? }] }` |
| `tools/tts/lines.seed.json` | tts pipeline | the starter set, same shape, used until `lines.json` exists |
| `public/audio/vo/<id>.mp3` | tts pipeline | mono MP3, loudness matched, leading and trailing silence trimmed |
| `public/audio/vo/manifest.json` | tts pipeline | what exists, see below |

## manifest.json

```json
{
  "version": 1,
  "voices": { "dave": { "name": "Senior Dev Dave" } },
  "lines": {
    "dave-1a2b3c4d": {
      "voice": "dave",
      "text": "Did anyone actually read the diff?",
      "file": "dave-1a2b3c4d.mp3",
      "dur": 2.34,
      "env": "0023689bcdfffedb97420",
      "words": [[0.02, 0.18], [0.18, 0.55]],
      "wer": 0.0
    }
  }
}
```

- `dur`: seconds, 2 decimals, of the final trimmed MP3.
- `env`: loudness envelope at 20 samples per second, one hex digit per sample
  (0 silent, f loudest in this clip). The game uses it to make speech bubbles and
  mouths move with the voice.
- `words`: optional. One `[startSec, endSec]` per whitespace separated word of
  `text`, aligned from the speech-to-text timestamps. The game falls back to even
  spacing when it is missing.
- `wer`: word error rate of the speech-to-text check against `text` (0 is perfect).
  Lines above 0.25 are retried with other seeds, and the best take is kept.
- A line missing from the manifest is simply silent in the game. Text still shows.

## Rules for everyone

- Nobody plays audio on this machine. No `afplay`, no `ffplay`, no `open x.mp3`,
  no browser with sound. Check voices with speech-to-text and numbers.
  The game backs this up: test links (`?debug`, `?demo`, `?scene`) and any automated
  browser send their sound to a silent output (`src/audio/quiet.ts`). Open a test link
  with `&sound=1` only if a person is at the machine and wants to hear it.
- The Python venv lives in `tools/tts/.venv` and is never committed.
- Voice descriptions describe sound (age, pitch, pace, timbre, accent, mood),
  never a real person's name.
