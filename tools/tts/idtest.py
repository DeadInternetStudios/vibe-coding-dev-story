#!/usr/bin/env python3
"""Print the line id for the contract's test vector.

    voice="dave", text="Did anyone actually read the diff?", delivery=none

Standard library only, so it runs with the system python3 and no venv. The game's
`npm run vo:idtest` must print the same single line.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ttslib.lineid import line_id  # noqa: E402

VOICE = "dave"
TEXT = "Did anyone actually read the diff?"

if __name__ == "__main__":
    print(line_id(VOICE, TEXT))
