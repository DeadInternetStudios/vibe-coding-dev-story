"""Line identity, exactly as docs/voice-contract.md defines it.

    id = voice + "-" + hex8(fnv1a32(utf8(voice + "|" + text + "|" + (delivery ?? ""))))

Standard library only: idtest.py imports this file and must run with any system
python3, no venv.
"""

FNV_OFFSET_BASIS = 2166136261
FNV_PRIME = 16777619


def fnv1a32(data):
    """32-bit FNV-1a over bytes: XOR the byte first, then multiply, wrap at 2^32."""
    h = FNV_OFFSET_BASIS
    for byte in data:
        h ^= byte
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h


def line_id(voice, text, delivery=None):
    key = voice + "|" + text + "|" + (delivery if delivery is not None else "")
    return "%s-%08x" % (voice, fnv1a32(key.encode("utf-8")))
