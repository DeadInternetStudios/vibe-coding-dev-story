# Handoff — Vibe Coding Dev Story

Written 2026-11-19 when the owner stopped the 100x run to change harness.
Everything below is the state at that moment. Read this first, then
`.100x/STATE.md` for the long version.

## Where things stand

- Branch: `main`, clean tree. HEAD before this file: `b1071d8`.
- The game is built and playable: Phaser 4.2.1 + Vite + TypeScript,
  Game Dev Story–style sim about vibe coding, 928 Qwen3-TTS voice clips.
- Tests: `npx vitest run` = 686 passed, 3 skipped (52 files).
  `npx tsc --noEmit` clean. Both green at `b1071d8`, no src change since.
- The 100x run is **NOT finished** and was left that way on purpose.
  Do not run `100x finish` expecting it to pass yet — see "What blocks a yes".

## Merging: nothing to do

All six `t3/*` branches are already ancestors of `main`
(`git merge-base --is-ancestor <branch> main` = yes, 0 commits ahead):

- `t3/art-brief-pixel-sprites` (a087d47)
- `t3/chiptune-sfx-music-engine` (7ccfed4)
- `t3/fill-game-content-files` (c18802c)
- `t3/qwen3-tts-voice-pipeline` (50d0e41)
- `t3/reddit-tropes-content-pack` (dcaf63d)
- `t3/trophy-case-daily-challenge` (6d7fe41)

So merging them into `main` is a no-op and there are no conflicts to
resolve. Their worktrees still exist under
`/Users/mac/.t3/worktrees/vibe-coding-dev-story/` — remove them only in
the new harness if that harness owns them; they were left untouched here.
One more worktree: `/tmp/base` (detached HEAD 7865dce), scratch from this
run, safe to remove with `git worktree remove /tmp/base --force`.

No stash. **Update 2026-11-21:** the owner asked for it to go public, so it now lives at
`https://github.com/DeadInternetStudios/vibe-coding-dev-story` under the MIT License (`LICENSE`) and deploys to
`https://deadinternetstudios.github.io/vibe-coding-dev-story/` from `.github/workflows/pages.yml` on every push to `main`.
The "never push" house rule below was for the old harness run; the owner's explicit request overrides it for this repo.
The F1 and F4 owner sign-offs are still open.

## Review state (4 rounds, all closed)

Rounds 1–4 are triaged and closed (`.100x/review/round-N/`).
Round 4 verdict was "Ready to sell: no" with 4 findings:

- F2 [major] **fixed** `503e4ed` — name boxes on the New Game screen
  opened over the origin cards instead of over the tapped field.
  Proof: `.100x/review/round4-F2-before-after.txt` (7/7 sizes after).
- F3 [major] **fixed** `b1071d8` — payday card rows didn't add up as
  drawn (income above the rule, bills-only total under it). Sim untouched.
  Proof: `.100x/review/round4-F3-before-after.txt` (96/96 checks, 6 sizes).
- F1 [blocker] **owner-only, open** — no person has ever heard the voices.
- F4 [major] **owner-only, open** — no real phone has ever run the game.

**A fresh judge has not seen the F2/F3 fixes.** That re-judge is the
next step in the old plan; in the new harness, either run one more
sell-test round on `main`, or accept the two proof files above.

## What blocks a "ready" verdict (owner only, ~10 minutes)

1. Voices: open `docs/voice-spot-check.html` on any machine **except
   this one** (see quiet-machine rule), play one clip per voice
   (3 minutes), flag bad takes. Then sign README.md
   ("Voices spot-checked … by:") and set `VOICES_HEARD_BY` in
   `src/core/version.ts` — a test ties the two together.
2. Real phone: follow README.md "On a real phone" (5 minutes, includes
   `?demo=thread&sound=1` on the phone itself), then fill
   "Played on a real phone by:" with name, phone, browser.

Until both are signed, README keeps saying "nobody yet" — never sign
on a machine's word.

## One loose end from the last hour

`.100x/review/round4-sliders.mjs` (Settings slider tap/drag check,
real mouse) finished after the stop: portrait sizes pass fully
(360×640, 390×844: 40/40), landscape/desktop rows report
"game shows null" (68 rows). That pattern points at the check script's
number-lookup at wide sizes, **not** a proven game bug — nobody
verified it either way. If it matters, fix the script's row pairing
first, then re-run against a fresh build before touching `src/ui/kit.ts`.

Also self-checked and clean, no action needed:
`.100x/review/round4-hitsweep.mjs` — 63 screens, 2,528 controls,
nothing covered or off-screen (Friday demo name only exists at seed 7).

## House rules that still apply

- **Quiet machine:** never play audio here. Browsers headless +
  `--mute-audio`; never add `&sound=1` to a test link; never press
  play on `docs/voice-spot-check.html`. Voices are verified by
  speech-to-text/numbers only.
- No global installs; project-local only. Don't `npx` unknown packages.
- Servers: none of mine are running (ports 5251/5252 stopped).
  Processes belonging to other projects (e.g. `/Users/mac/Documents/GitHub/3js-demo`)
  are not ours — don't kill them.
- Git: commit locally, never push, never rewrite history, no `git stash`.
- Must-not-break proofs are fresh at `b1071d8`'s parent build
  (`.100x/must-not-break/`, main-flow 8/8, red proof fails as planted,
  rotation 12/12). If `src` changes, re-run them on a frozen build.
- The 100x watchdog is still scheduled:
  `scheduled-task:f7e54040-cff5-4002-a240-51e393964f5a`
  (`.100x/watchdog.json`). Delete it when the new harness takes over,
  then `100x watchdog clear` if that tooling still applies.

## Key files

- Findings: `.100x/review/findings.md` (round 4), `.100x/review/round-3/findings.md`
- Triage: `.100x/review/round-3/triage.md`; round 4 triage was consumed
  by `100x triage` (copy of its text in `.100x/decisions.tsv` log entry)
- State/decisions: `.100x/STATE.md`, `.100x/decisions.tsv`, `.100x/project.md`
- Run config: `.100x/run.json` (must-not-break entries, verdict fields unset)
