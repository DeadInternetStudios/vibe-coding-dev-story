"""Manifest and render-state files: atomic writes, stable one-entry-per-line layout, a run lock.

manifest.json follows docs/voice-contract.md exactly (version, voices{id:{name}}, lines{id:{voice,
text, file, dur, env, words, wer}}). Everything about HOW a line was rendered (seed, attempts,
voice signature) lives in render-state.json, which the game never reads.
"""
from __future__ import annotations

import contextlib
import fcntl
import hashlib
import json
import os
import tempfile

LINE_KEYS = ("voice", "text", "file", "dur", "env", "words", "wer")


def atomic_write(path: str, text: str) -> None:
    """Write beside the target, fsync, rename. A crash leaves the old file or the new one."""
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".part", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def _compact(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def dump_manifest(manifest: dict) -> str:
    voices = manifest.get("voices", {})
    lines = manifest.get("lines", {})
    v_rows = ",\n".join("  %s: %s" % (json.dumps(k), _compact(v)) for k, v in voices.items())
    l_rows = ",\n".join(
        "  %s: %s" % (json.dumps(k), _compact({key: lines[k][key] for key in LINE_KEYS if key in lines[k]}))
        for k in sorted(lines)
    )
    return '{\n "version": %d,\n "voices": {\n%s\n },\n "lines": {\n%s\n }\n}\n' % (
        manifest.get("version", 1), v_rows, l_rows,
    )


def load_manifest(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            m = json.load(fh)
        m.setdefault("version", 1)
        m.setdefault("voices", {})
        m.setdefault("lines", {})
        return m
    return {"version": 1, "voices": {}, "lines": {}}


def save_manifest(path: str, manifest: dict) -> None:
    atomic_write(path, dump_manifest(manifest))


def load_state(path: str) -> dict:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            s = json.load(fh)
        s.setdefault("version", 1)
        s.setdefault("lines", {})
        return s
    return {"version": 1, "lines": {}}


def save_state(path: str, state: dict) -> None:
    rows = ",\n".join("  %s: %s" % (json.dumps(k), _compact(state["lines"][k])) for k in sorted(state["lines"]))
    atomic_write(path, '{\n "version": %d,\n "lines": {\n%s\n }\n}\n' % (state.get("version", 1), rows))


def mp3_looks_valid(path: str, dur: float | None = None) -> bool:
    """Cheap integrity check without decoding: exists, has an MP3 frame sync or ID3 header,
    and its size fits the duration for a 12 to 80 kbps speech file (catches truncated writes)."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as fh:
            head = fh.read(4)
    except OSError:
        return False
    if size < 400 or len(head) < 4:
        return False
    if not (head[:3] == b"ID3" or (head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)):
        return False
    if dur:
        kb_per_s = size / 1000.0 / max(dur, 0.05)
        if not (1.4 <= kb_per_s <= 10.5):
            return False
    return True


@contextlib.contextmanager
def run_lock(manifest_path: str):
    """One generate.py per manifest at a time (flock, released when the process dies)."""
    key = hashlib.sha1(os.path.abspath(manifest_path).encode()).hexdigest()[:10]
    lock_path = os.path.join(tempfile.gettempdir(), "vo-generate-%s.lock" % key)
    fh = open(lock_path, "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        raise SystemExit("another generate.py already holds %s" % lock_path)
    try:
        fh.write(str(os.getpid()))
        fh.flush()
        yield lock_path
    finally:
        fcntl.flock(fh, fcntl.LOCK_UN)
        fh.close()
