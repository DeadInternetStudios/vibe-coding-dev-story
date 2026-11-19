#!/usr/bin/env bash
# Render and measure one song, all offline (no sound is ever played).
#
#   tools/audio/song.sh mix <song>       full mix at the default intensity, 0 and 1, then the analysis
#   tools/audio/song.sh balance <song>   every layer alone, then the layer balance table
#   tools/audio/song.sh all <song>       both
#
# Renders run in parallel. Results land in tools/audio/out/ (git ignored).
set -euo pipefail
cd "$(dirname "$0")/../.."

mode="${1:?usage: song.sh mix|balance|all <song>}"
song="${2:?usage: song.sh mix|balance|all <song>}"
py=tools/audio/.venv/bin/python
wav=tools/audio/out/wav/music

layers() {
  npx tsx -e "import { SoundEngine } from './src/audio/engine'; const m = SoundEngine.MUSIC.find((x) => x.id === '$song'); if (!m || m.layers.length === 0) process.exit(2); console.log(m.layers.join(' '));"
}

mix() {
  rm -f "$wav/$song.wav" "$wav/$song@0.wav" "$wav/$song@100.wav"
  npx tsx tools/audio/render.ts music "$song" --name "$song" >/dev/null &
  npx tsx tools/audio/render.ts music "$song" --intensity 0 --name "$song@0" >/dev/null &
  npx tsx tools/audio/render.ts music "$song" --intensity 1 --name "$song@100" >/dev/null &
  wait
  "$py" tools/audio/analyze.py --only "$song,$song@0,$song@100" --notes /tmp/notes-"$song".md | grep -E "^$song" || true
  npx tsx tools/audio/dump.ts >/dev/null
  "$py" tools/audio/analyze.py --rolls >/dev/null
}

balance() {
  local names=""
  rm -f "$wav/$song#"*.wav
  for l in $(layers); do
    npx tsx tools/audio/render.ts music "$song" --solo "$l" --loops 1 >/dev/null &
    names="$names,$song#$l"
  done
  wait
  "$py" tools/audio/analyze.py --only "${names#,}" --notes /tmp/notes-"$song"-layers.md --no-png >/dev/null
  sed -n '/AUTO:BEGIN layers/,/AUTO:END layers/p' /tmp/notes-"$song"-layers.md
}

case "$mode" in
  mix) mix ;;
  balance) balance ;;
  all) mix; balance ;;
  *) echo "unknown mode $mode" >&2; exit 1 ;;
esac
