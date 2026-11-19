#!/usr/bin/env bash
# Render, measure and calibrate every sound effect, all offline (no sound is ever played).
#
#   tools/audio/sfx.sh measure      render + analyze, print one line per sound
#   tools/audio/sfx.sh flagged      same, but only the sounds with a flag
#   tools/audio/sfx.sh calibrate    measure, then write the new trims into src/audio/levels.ts
#   tools/audio/sfx.sh settle       calibrate twice (a trim only converges after a re-measure), then show what is left
#
# BACKEND=chromium makes every step run on a muted headless Chromium instead of node-web-audio-api.
# The game plays in a browser, so the final levels are set that way; node is the quick proxy.
# PNG=1 also draws the spectrograms (the calibration loops skip them).
#
# The order matters: the trim in force when a sound was rendered is recorded in the
# analysis, and calibrate adds the missing dB to it. Calibrating twice from one
# analysis changes nothing, so every pass renders and analyzes first.
set -euo pipefail
cd "$(dirname "$0")/../.."

py=tools/audio/.venv/bin/python
backend="${BACKEND:-node}"
out=tools/audio/out
render_flags=""
case "$backend" in
  node) ;;
  chromium) out=tools/audio/out/chromium; render_flags="--backend chromium --out $out" ;;
  *) echo "BACKEND must be node or chromium, not $backend" >&2; exit 1 ;;
esac
png_flag="--no-png"
[ "${PNG:-0}" = "1" ] && png_flag=""
analysis="$out/analysis.json"

measure() {
  # render_flags and png_flag are deliberately unquoted: each is zero or more separate words
  # shellcheck disable=SC2086
  npx tsx tools/audio/render.ts sfx all $render_flags >/dev/null
  local names
  names=$(ls "$out/wav/sfx" | sed 's/\.wav$//' | paste -sd, -)
  # shellcheck disable=SC2086
  "$py" tools/audio/analyze.py --out "$out" --only "$names" --no-notes $png_flag --notes /tmp/notes-sfx.md | grep -E '^[a-z_0-9]+ +peak' || true
}

calibrate() {
  measure >/dev/null
  npx tsx tools/audio/calibrate.ts --sfx --write --analysis "$analysis"
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
