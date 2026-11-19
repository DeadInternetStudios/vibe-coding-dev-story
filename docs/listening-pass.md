# Listening pass

The voice checks so far are machine checks (speech to text, loudness). This is the human one: you listen, flag the bad
takes, get them re-rendered, and sign off. The page lets you stop and resume. It plays nothing until you press Play, Space or N.

## Build and open

```sh
npx tsx tools/listen/build.ts        # writes docs/listening-pass.html and prints what is in each tier
open docs/listening-pass.html        # or: python3 -m http.server 8000, then /docs/listening-pass.html
```

Open it the same way every time: the browser keeps your marks per address. Use headphones. Rebuild after any re-render. The
page finds the audio at `../public/audio/vo/`, so leave it in `docs/`. It lists the 863 clips the game can say; the 65 audition
takes in the audio folder, which nothing plays, stay off it (`--include-unused` adds them). Today, 525 different clips and about
54 minutes of audio (the build prints the current numbers):

- **A, most-heard voices:** every clip of the six voices with most clips (Dave, Clod, Narrator, Chad, Announcer, Jenny). 438 clips, 45 min.
- **B, first session:** intro, tutorial, first deploy, the Friday decision, narrator lines. 80 clips, 9 min, 78 of them also in A.
- **C, random 20% of the rest:** fixed seed, the same share from every voice. 85 clips, 9 min.

## What to listen for

Sung or musical word (a word turns into a note). Wrong stress (the joke lands on the wrong word). Glitch or breath (click,
gasp, stutter, repeated word). Wrong voice or accent (see "Meant to sound like"). Too quiet or too loud next to the clip
before. Cut off (last word clipped, or it ends early).

## Working through it

**Space** play or pause, **J** and **K** next and previous, **O** ok, **F** flag (1 to 7 pick reasons, Enter saves), **N** next and
play, **U** undo, **T** next to do, **A** auto-advance (off at first), **?** all keys. Type your name in Listener. Every click is
saved in the browser; Tools, Save progress file makes a backup. Export flags downloads `flagged-lines.json`:
`[{"clip": "dave-5b478600", "voice": "dave", "text": "...", "reasons": ["wrong stress"], "note": "..."}]`

## Re-render

```sh
npx tsx tools/listen/flags-to-redo.ts flagged-lines.json    # checks the ids, prints the commands below
cd tools/tts                                                # stop watch.sh first: one generate.py per manifest
.venv/bin/python generate.py --lines lines.json --redo-id dave-5b478600 --dry-run   # lists, loads no model
.venv/bin/python generate.py --lines lines.json --redo-id dave-5b478600             # one --redo-id per clip
```

This checkout has no `tools/tts/.venv` (`./setup.sh` builds it), so the following is read from `generate.py`, not run.
`--redo-id` re-renders a clip with the seeds it was first rendered with (`seed_for(id, k)`), so the same take is the expected
result unless the voice description, model or `ident.json` changed. `--polish` uses fresh seeds, but only for clips its own
score picks, and it keeps the new take only if that score improves; a human flag does not qualify. Nothing re-renders one id
with new seeds and keeps the result. That switch is missing; `render_line` already takes a `round_` that picks fresh seeds.

What changes a take today: reword the line or change its `delivery` note in `src/content` (new id, new seeds; run
`npm run vo:export`, then `generate.py`; the old clip stays in the manifest, unused). If a whole voice is off, change its
description or `trim` in `tools/tts/voices.json` and rerun `generate.py`, or use `--redo-voice`. After a re-render, build again:
a clip whose audio changed shows "Rendered again" in yellow and counts as to do. Listen, press OK.

## Sign off

When A and B are fully marked and C has 90%, a Sign-off box shows one line, for example `Voices heard by Sam on 2026-11-19: 525
clips, 4 flagged and re-rendered.` Copy it into `README.md`, in "The voices", in place of `> Voices heard end to end by: nobody yet.`
(keep the `>`). Flags still open are named in the line, so fix or accept them first.
