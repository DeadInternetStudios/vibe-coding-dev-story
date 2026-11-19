#!/usr/bin/env bash
# Render, measure and calibrate the loudness of every song, all offline (no sound is ever played).
#
#   tools/audio/music.sh measure      render + analyze every song at its default intensity, one line each
#   tools/audio/music.sh calibrate    measure, then write the new trims into src/audio/levels.ts
#   tools/audio/music.sh settle       calibrate twice (a trim only converges after a re-measure), then show what is left
#
# BACKEND=chromium runs every step on a muted headless Chromium instead of node-web-audio-api: the
# game plays in a browser, so the final levels are set that way. node is the quick proxy.
# PNG=1 also draws the spectrograms. JOBS=n renders n songs at once (default 4).
#
# Only the default mix of each song is touched here. The layer balance inside a song is
# tools/audio/song.sh and tools/audio/rebalance.ts; this sets one trim per song on top of it.
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
jobs="${JOBS:-4}"
songs="${SONGS:-title office crunch thread launch awards shop win lose menu}"

measure() {
  # render_flags and png_flag are deliberately unquoted: each is zero or more separate words
  # shellcheck disable=SC2086
  printf '%s\n' $songs | xargs -P "$jobs" -I{} sh -c "npx tsx tools/audio/render.ts music {} $render_flags >/dev/null"
  # shellcheck disable=SC2086
  "$py" tools/audio/analyze.py --out "$out" --only "$(echo $songs | tr ' ' ',')" --no-notes $png_flag --notes /tmp/notes-music.md | grep -E '^[a-z]+ +peak' || true
}

calibrate() {
  measure >/dev/null
  npx tsx tools/audio/calibrate.ts --music --write --analysis "$analysis"
}

# a song line is "name peak P LUFS-I L" and analyze.py adds its flags after that, so a flagged line has more than five words
flagged() { awk 'NF > 5 { print; n++ } END { if (!n) print "no song has a flag" }'; }

case "${1:?usage: music.sh measure|calibrate|settle}" in
  measure) measure ;;
  calibrate) calibrate ;;
  settle)
    calibrate
    calibrate
    measure | tee /tmp/music-settled.txt | flagged
    ;;
  *) echo "unknown mode $1" >&2; exit 1 ;;
esac
