#!/usr/bin/env bash
# Render, measure and calibrate every sound effect, all offline (no sound is ever played).
#
#   tools/audio/sfx.sh measure      render + analyze, print one line per sound
#   tools/audio/sfx.sh flagged      same, but only the sounds with a flag
#   tools/audio/sfx.sh calibrate    measure, then write the new trims into src/audio/levels.ts
#   tools/audio/sfx.sh settle       calibrate twice (a trim only converges after a re-measure), then show what is left
#
# The order matters: the trim in force when a sound was rendered is recorded in the
# analysis, and calibrate adds the missing dB to it. Calibrating twice from one
# analysis changes nothing, so every pass renders and analyzes first.
set -euo pipefail
cd "$(dirname "$0")/../.."

py=tools/audio/.venv/bin/python

measure() {
  npx tsx tools/audio/render.ts sfx all >/dev/null
  local names
  names=$(ls tools/audio/out/wav/sfx | sed 's/\.wav$//' | paste -sd, -)
  "$py" tools/audio/analyze.py --only "$names" --no-notes --notes /tmp/notes-sfx.md | grep -E '^[a-z_0-9]+ +peak' || true
}

calibrate() {
  measure >/dev/null
  npx tsx tools/audio/calibrate.ts --sfx --write
}

case "${1:?usage: sfx.sh measure|flagged|calibrate|settle}" in
  measure) measure ;;
  flagged) measure | grep -E 'LUFS|DC|LATE|HARSH|CLIP|PEAK|NaN' || echo "no sound effect has a flag" ;;
  calibrate) calibrate ;;
  settle)
    calibrate
    calibrate
    measure | grep -E 'LUFS|DC|LATE|HARSH|CLIP|PEAK|NaN' || echo "settled: no sound effect has a flag"
    ;;
  *) echo "unknown mode $1" >&2; exit 1 ;;
esac
