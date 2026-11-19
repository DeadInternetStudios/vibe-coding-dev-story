# Voice pipeline (`tools/tts`)

Offline pipeline that turns the game's spoken lines into small MP3s. Every commenter gets a voice
invented from a text description by **Qwen3-TTS-12Hz-1.7B-VoiceDesign**, running locally on Apple
silicon through MLX. The game never calls a model: it loads `public/audio/vo/manifest.json` and the
MP3s next to it. Binding spec: [`docs/voice-contract.md`](../../docs/voice-contract.md) (line ids, file layout,
manifest shape). Cast: [`cast.seed.md`](cast.seed.md).

```
voices.json  +  lines.json / lines.seed.json  ->  generate.py  ->  public/audio/vo/<id>.mp3  +  manifest.json
(who speaks)    (what they say)                  (model, speech-to-text check, mastering)
```

**Nothing here ever plays audio.** Quality is checked with speech to text (Parakeet) and numbers
(duration, speech rate, pitch, loudness, clipping, silence). See [Quiet machine](#quiet-machine).

## Quick start

```sh
cd tools/tts
./setup.sh                        # builds .venv from scratch with pinned versions (needs uv and ffmpeg)
.venv/bin/python idtest.py        # prints dave-f3434638, the contract's test vector
.venv/bin/python generate.py      # renders every line that is missing, resumable, safe to stop and rerun
```

`setup.sh` flags: `--models` also downloads the weights now (about 5 GB, into the normal Hugging Face
cache), `--latest` resolves `requirements.txt` fresh instead of `requirements.lock.txt`.
Environment: `TTS_VENV` (venv path), `TTS_PYTHON` (default 3.12). It installs nothing outside the venv.

A long run, detached from the terminal:

```sh
cd tools/tts
nohup .venv/bin/python generate.py > /dev/null 2>&1 &     # progress goes to tools/tts/generate.log
tail -f generate.log
```

Look at the result: serve the repo root and open the gallery
(`python3 -m http.server 8000`, then `http://localhost:8000/tools/tts/gallery.html`). It lists every
voice with its description and every line with an audio control, WER, duration, the loudness envelope
and a word highlight driven by the manifest timings. It does not play anything by itself.

## What `generate.py` does for each line

1. Reads lines from `--lines` (default: `tools/tts/lines.json` if it has lines, else `lines.seed.json`).
   The id is checked against the contract formula; a mismatch is logged as an error.
2. Asks the model for a take: voice description + the line's `delivery` note as the instruction,
   the text as the content, a deterministic seed per (line, attempt), and a token cap proportional to
   the word count so a looping take cannot run on.
3. Trims silence, matches loudness (BS.1770 integrated, target -19 LUFS plus the voice's `trim`),
   limits peaks at -2 dBFS, encodes mono 24 kHz MP3 at 32 kbps.
4. Measures **the decoded MP3 (the file the game loads)**: speech to text, WER, duration, pitch,
   speaking rate, clipping, longest pause.
5. Scores the take (`ttslib/qa.py`). Hard failures: WER above 0.25, hit the token cap, clipping, rushed
   or dragged. Soft: extra words the model improvised, a long pause, pitch or pace outside the voice's
   `target` band. A pull toward the middle of the band keeps sampling until a take is close to the voice.
6. Up to 4 takes, stops at the first excellent one, keeps the best. A line that never passes keeps its
   best take and shows up as weak in the summary, so there is always something to hear.
7. Writes the MP3 and rewrites `manifest.json` atomically after **every** line, plus
   `render-state.json` (seed, attempts, signatures). `dur` and `env` (20 per second, one hex digit,
   `f` loudest in the clip) are from the final MP3; `words` is one `[start, end]` per word.

Re-running is idempotent. A line is skipped when the manifest entry, a valid MP3 and a matching
voice signature all exist. An MP3 without a manifest entry is adopted (speech to text only, no model).
A line whose voice description or sampling changed is re-rendered. A line whose only change is
loudness or encoding is remastered from the stored raw take. Kill the run at any time; the next run
continues. A second run on the same manifest refuses to start while the first holds the lock.

### Flags

| Flag | Meaning |
| --- | --- |
| `--lines a.json b.json` | one or more lines files, merged by id |
| `--out DIR` | where MP3s go (default `public/audio/vo`) |
| `--manifest FILE` | default `<out>/manifest.json` |
| `--voices FILE` | default `tools/tts/voices.json` |
| `--state FILE` | default `tools/tts/render-state.json` |
| `--only VOICE` | only this voice (repeatable) |
| `--limit N` | render at most N lines this run |
| `--attempts N` | takes per line, 1 to 4 (the contract's maximum) |
| `--redo-id ID`, `--redo-voice VOICE`, `--redo-wer X` | render again: that line, that voice, every line above that WER |
| `--keep-stale` | leave lines alone even if their voice changed |
| `--dry-run` | list what would be rendered, load no model |
| `--audit` | per-voice statistics and suspicious lines from the manifest, then exit |
| `--accept-wer X`, `--kbps N` | WER accepted (default 0.25), MP3 bitrate (default 32, 24 to 64) |
| `--log FILE`, `--takes DIR` | log file and raw-take cache (both stay local, git ignored) |

A line that crashes is logged and skipped; the run keeps going. SIGTERM and SIGINT finish the take in
flight and stop cleanly.

### Rendering from another checkout

If this branch is merged, run the same two commands in that checkout (`./setup.sh`, then `generate.py`).
To render into another checkout's tree without merging, call this checkout's tools with explicit paths:

```sh
TOOLS=/path/to/this/checkout/tools/tts
GAME=/path/to/the/game/checkout
cd "$TOOLS" && .venv/bin/python generate.py \
  --lines "$GAME/tools/tts/lines.json" \
  --out "$GAME/public/audio/vo" \
  --state "$GAME/tools/tts/render-state.json"
```

`manifest.json` and `render-state.json` are generated files. If a merge conflicts on them, take either
side and run `generate.py` again: it converges (valid MP3s are kept, missing entries are adopted).

## Adding or changing lines

The game side owns `tools/tts/lines.json`: `{"version": 1, "lines": [{"id", "voice", "text", "delivery"?}]}`.
Ids follow the contract: `voice + "-" + hex8(fnv1a32(voice|text|delivery))`, implemented in
`ttslib/lineid.py` and proven by `idtest.py`. Any change to the text or delivery is a new id, so the old
MP3 stays on disk (nothing is ever deleted) and the new one is rendered next run.

Hand-written demo lines go in `cast.extra.md` (`## voice` headings, bullets `- text [delivery note]`);
`build_seed.py --all` turns `cast.seed.md` into `lines.seed.json` and `cast.extra.md` into `lines.extra.json`.
Render them with `generate.py --lines lines.seed.json lines.extra.json`.

Write lines for the ear: spell out what must be said aloud (`doStuff` is fine, `v2.0.1-beta` is not),
avoid long digit strings, and keep one idea per sentence. The WER check will tell you when the model
cannot say something.

## Adding or changing a voice

Each entry in `voices.json` (the key is the voice id: lowercase letters and digits, no dash):

```json
"dave": {
  "name": "Senior Dev Dave",
  "role": "Senior developer",
  "description": "A tired American man in his mid fifties with a low, gravelly baritone voice ...",
  "trim": -1.0,
  "sampling": {"temperature": 0.7, "top_k": 40},
  "target": {"f0": [65, 110], "wps": [1.3, 2.4], "f0_std_st": [0, 2.6]}
}
```

- `description` is the whole voice. Use concrete acoustic words: register (`bass`, `baritone`, `tenor`,
  `alto`), age, texture (`gravelly`, `breathy`, `nasal`), pace, energy, accent. Words like `high
  pitched`, `energetic` and `excited` are taken literally and push pitch far up; name the register instead.
- `trim` is dB added on top of the common loudness target (whispers negative, shouters positive).
- `sampling` is optional (defaults `temperature 0.7`, `top_k 40`).
- `target` is the intent: median pitch band in Hz, speaking rate band in words per second, optional
  pitch spread band in semitones. It is the retry gate, not a promise about taste.

Tune with numbers, not ears:

```sh
.venv/bin/python tune.py --voice dave                      # 5 shared probe lines, per-voice table, PASS/FAIL against target
.venv/bin/python tune.py --voice dave --lines 10 --variant "cold:temperature=0.4,top_k=20"
.venv/bin/python tune.py --voice dave --desc "A different description to try"
```

It prints pitch (mean, variation, spread), spectral centroid, pace, WER and real-time factor, and keeps
the takes in `scratch/tune/` so you can compare them with other tools. After changing a description,
`generate.py` re-renders that voice's lines on its own (the voice signature changed).

Two facts from measuring this model, so you do not rediscover them:

- Different seeds for the **same line** differ by about 3 semitones of median pitch, more than different
  lines differ from each other. The cure is selection (the retry gate), not a lower temperature.
- Pitch trackers need a high enough ceiling. A child or cartoon voice measured with a 400 Hz ceiling
  reports half its real pitch. `ttslib/audio.py` tracks with a wide range and then narrows it.

## Quiet machine

Nobody wants an overnight run talking to an empty room. `ttslib/__init__.py` blocks the audio device
library before anything can import it, and nothing in this folder calls a player. Do not add `afplay`,
`ffplay`, `open file.mp3`, a browser with sound, or `say`. Use `--audit`, `tune.py`, and the gallery's
numbers. Only open the gallery when a human is at the machine.

## Layout

| Path | What |
| --- | --- |
| `generate.py` | the render pipeline |
| `voices.json` | the cast: descriptions, loudness trims, intent bands |
| `lines.seed.json`, `lines.extra.json` | lines built from `cast.seed.md` and `cast.extra.md` by `build_seed.py` |
| `ttslib/` | `lineid` (contract id), `tts` (model), `stt` (speech to text, WER, word timings), `audio` (trim, loudness, MP3, measurements), `qa` (take scoring), `manifest` (atomic writes, state, lock) |
| `tune.py`, `spike.py` | measurement tools: voice tuning, and the spike that picked the approach |
| `idtest.py` | contract test vector, standard library only |
| `gallery.html` | static page to browse voices and lines |
| `setup.sh`, `requirements*.txt` | recreate the venv |
| `render-state.json` | how each line was rendered (committed so reruns converge) |
| `.venv/`, `scratch/`, `generate.log` | local only, git ignored |

Design notes, measurements and the tuning log: [`docs/voice-notes.md`](../../docs/voice-notes.md).
