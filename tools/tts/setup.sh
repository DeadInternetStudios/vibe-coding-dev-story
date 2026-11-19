#!/usr/bin/env bash
# Recreate tools/tts/.venv from scratch. Everything stays inside the venv (no global installs,
# no brew, no pip --user, no sudo). Model weights go to the normal Hugging Face cache.
#
#   tools/tts/setup.sh              exact pinned set from requirements.lock.txt
#   tools/tts/setup.sh --latest     resolve requirements.txt fresh (newer, untested)
#   tools/tts/setup.sh --models     also download the model weights now (about 5 GB)
#
# Needs: uv (https://docs.astral.sh/uv/), ffmpeg, and a Python 3.11 to 3.13 that uv can find.
set -euo pipefail

cd "$(dirname "$0")"
VENV="${TTS_VENV:-.venv}"
PYVER="${TTS_PYTHON:-3.12}"
LATEST=0
MODELS=0
for arg in "$@"; do
  case "$arg" in
    --latest) LATEST=1 ;;
    --models) MODELS=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

command -v uv >/dev/null 2>&1 || { echo "uv is required: https://docs.astral.sh/uv/" >&2; exit 1; }
if ! command -v ffmpeg >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/ffmpeg ]; then
  echo "ffmpeg is required (expected on PATH or at /opt/homebrew/bin/ffmpeg)" >&2
  exit 1
fi
if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "warning: MLX needs Apple silicon macOS; this is $(uname -s) $(uname -m)" >&2
fi

echo "==> creating $VENV with python $PYVER"
rm -rf "$VENV"
uv venv --python "$PYVER" "$VENV"
PY="$VENV/bin/python"

if [ "$LATEST" = 1 ]; then
  echo "==> installing requirements.txt (latest compatible)"
  uv pip install --python "$PY" -r requirements.txt
else
  echo "==> installing requirements.lock.txt (pinned)"
  uv pip install --python "$PY" -r requirements.lock.txt
fi

echo "==> checking imports"
"$PY" - <<'PYEOF'
import importlib
for m in ("mlx.core", "mlx_audio.tts.utils", "parakeet_mlx", "parselmouth", "pyloudnorm", "soundfile", "num2words", "scipy"):
    importlib.import_module(m)
import mlx.core as mx
print("imports ok, mlx", mx.__version__ if hasattr(mx, "__version__") else "?", "device", mx.default_device())
PYEOF

echo "==> id test vector (must print dave-f3434638)"
"$PY" idtest.py

if [ "$MODELS" = 1 ]; then
  echo "==> downloading model weights into the Hugging Face cache"
  "$PY" - <<'PYEOF'
from huggingface_hub import snapshot_download
for repo in ("mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16", "mlx-community/parakeet-tdt-0.6b-v2"):
    print(repo, "->", snapshot_download(repo))
PYEOF
fi

echo "done. Next: $VENV/bin/python generate.py --dry-run"
