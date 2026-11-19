"""Offline voice pipeline for Vibe Coding Dev Story.

Keep this file import-light and standard library only: idtest.py imports ttslib.lineid with a
bare system python.

QUIET MACHINE GUARD. Nothing in the pipeline may ever play audio. mlx-audio drags in
`sounddevice` (PortAudio) for its live players; blocking the module here means that even by
accident no code that imports ttslib can open an output device.
"""
import sys

sys.modules.setdefault("sounddevice", None)  # `import sounddevice` now raises ImportError
