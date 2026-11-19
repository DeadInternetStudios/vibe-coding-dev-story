#!/usr/bin/env bash
# Keep the shop open: every INTERVAL seconds, render the lines another checkout asks for that this checkout
# does not have yet, into THIS checkout's public/audio/vo. Nothing is written to the other checkout.
#
#   tools/tts/watch.sh /path/to/game/checkout                       # poll every 600 s
#   tools/tts/watch.sh /path/to/game/checkout 300 --commit
#   tools/tts/watch.sh /path/to/game/checkout 600 --ref main --commit --polish
#
# Where the lines come from:
#   default    GAME/tools/tts/lines.json, the file `npm run vo:export` writes.
#   --ref REF  ignore that file. Run the game's own exporter (tools/vo-export.ts) on a scratch copy of the
#              commit REF, using GAME/node_modules, so the lines are always what the game's content says
#              right now, even when nobody committed lines.json. Needs git, node and an installed GAME.
#
# --commit   every run that changed anything commits public/audio/vo and render-state.json on the current
#            branch (plain message).
# --batch N  render at most N new lines per run (default 50). When a run added lines, the next run starts at
#            once, so a long queue is worked off in batches that are each committed; the sleep only happens
#            when the queue is empty.
# --polish   also give weak or off-band takes a second chance (generate.py --polish).
#
# generate.py does nothing and loads no model when there is no work, and refuses to start while another run
# holds the manifest lock, so this is safe next to manual runs. Stop it with Ctrl-C or by killing the process;
# a render in flight finishes its current take first.
set -u
GAME=""
INTERVAL=600
COMMIT=0
REF=""
BATCH=50
GEN_FLAGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --commit) COMMIT=1 ;;
    --polish) GEN_FLAGS+=(--polish) ;;
    --ref) REF="${2:?--ref needs a git ref}"; shift ;;
    --batch) BATCH="${2:?--batch needs a number}"; shift ;;
    -*) echo "unknown flag $1" >&2; exit 2 ;;
    *) if [ -z "$GAME" ]; then GAME="$1"; else INTERVAL="$1"; fi ;;
  esac
  shift
done
[ -n "$GAME" ] || { echo "usage: watch.sh /path/to/game/checkout [interval_seconds] [--ref REF] [--batch N] [--commit] [--polish]" >&2; exit 2; }

cd "$(dirname "$0")"
HERE="$PWD"
REPO="$(git rev-parse --show-toplevel)"
export PYTHONUNBUFFERED=1

export_lines() {
  if [ -z "$REF" ]; then
    echo "$GAME/tools/tts/lines.json"
    return 0
  fi
  local dir="$HERE/scratch/export"
  rm -rf "$dir" && mkdir -p "$dir" || return 1
  git -C "$GAME" archive "$REF" | tar -x -C "$dir" || return 1
  ln -s "$GAME/node_modules" "$dir/node_modules"
  (cd "$dir" && node node_modules/.bin/tsx tools/vo-export.ts >&2) || return 1
  echo "$dir/tools/tts/lines.json"
}

count_lines() {
  .venv/bin/python -c "import json;print(len(json.load(open('$REPO/public/audio/vo/manifest.json'))['lines']))" 2>/dev/null || echo 0
}

trap 'echo "watch.sh stopped"; exit 0' INT TERM
while true; do
  before="$(count_lines)"
  if LINES="$(export_lines)"; then
    .venv/bin/python generate.py --lines "$LINES" lines.seed.json lines.extra.json --limit "$BATCH" ${GEN_FLAGS[@]+"${GEN_FLAGS[@]}"}
  else
    echo "$(date +%H:%M:%S) could not read the game's lines, will retry" >&2
  fi
  after="$(count_lines)"
  if [ "$COMMIT" = 1 ] && [ -n "$(git -C "$REPO" status --porcelain -- public/audio/vo tools/tts/render-state.json)" ]; then
    git -C "$REPO" add public/audio/vo tools/tts/render-state.json
    git -C "$REPO" commit -q -m "Render voice lines: $after in the manifest"
  fi
  [ "$after" != "$before" ] && continue
  sleep "$INTERVAL" &
  wait $!
done
