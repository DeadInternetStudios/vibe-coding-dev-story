#!/usr/bin/env python3
"""Fast checks of the pipeline's pure logic. No model, no GPU, no audio device, a few seconds.

    .venv/bin/python selftest.py

Covers the contract id, the WER normalizer and word timings, the take scoring gate, the polish rule, the
loudness and MP3 chain, and the manifest writer. Run it after touching anything under ttslib/ or generate.py.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib import audio, qa, stt  # noqa: E402
from ttslib import manifest as mf  # noqa: E402
from ttslib.lineid import line_id  # noqa: E402

SR = 24000
TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def speechlike(seconds: float, f0: float = 120.0, level: float = 0.2, lead: float = 0.0, tail: float = 0.0) -> np.ndarray:
    """A voiced, syllable-modulated tone with harmonics: enough like speech for the level and pitch code."""
    t = np.arange(int(seconds * SR)) / SR
    x = sum(np.sin(2 * np.pi * f0 * k * t) / k for k in range(1, 9))
    x = x * (0.55 + 0.45 * np.sin(2 * np.pi * 3.5 * t) ** 2)
    x = (level * x / np.abs(x).max()).astype(np.float32)
    return np.concatenate([np.zeros(int(lead * SR), np.float32), x, np.zeros(int(tail * SR), np.float32)])


@test
def contract_ids():
    assert line_id("dave", "Did anyone actually read the diff?") == "dave-f3434638"
    assert line_id("dave", "Did anyone actually read the diff?", "") == "dave-f3434638"
    assert line_id("dave", "Did anyone actually read the diff?", "deadpan") == "dave-48599375"
    assert line_id("kid", "Ünïcode ✓").startswith("kid-") and len(line_id("kid", "Ünïcode ✓")) == len("kid-") + 8


@test
def wer_normalizer():
    s = stt.score
    assert s("Did anyone actually read the diff?", "Did anyone actually read the diff?").wer == 0
    assert s("This is doStuff.", "This is do stuff.").wer == 0, "camelCase split is not an error"
    assert s("It is 10x faster", "It is 10 x faster").wer == 0
    assert s("thirty years", "30 years").wer == 0
    assert s("4,000 lines long", "four thousand lines long").wer == 0
    assert s("Ok, fine", "Okay fine").wer == 0
    r = s("one two three four", "one two tree four")
    assert r.wer == 0.25 and r.errors == 1
    r = s("one two three", "uh one two three")
    assert r.extra == 1 and r.missing == 0
    r = s("one two three four", "one two")
    assert r.missing == 2


@test
def word_timing():
    text = "Did anyone read the diff?"
    hyp = [("Did", 0.0, 0.3), ("anyone", 0.3, 0.8), ("read", 0.9, 1.2), ("the", 1.2, 1.35), ("diff", 1.35, 1.9)]
    wt = stt.word_times(text, hyp, 2.0)
    assert len(wt) == len(text.split())
    assert all(0 <= a <= b <= 2.0 for a, b in wt)
    assert all(wt[i][0] <= wt[i + 1][0] for i in range(len(wt) - 1)), "start times must not go backwards"
    assert wt[0][0] == 0.0 and wt[-1][1] <= 2.0
    # a word the recognizer missed still gets a slot
    wt2 = stt.word_times(text, [h for h in hyp if h[0] != "read"], 2.0)
    assert len(wt2) == 5


@test
def loudness_and_trim():
    x = speechlike(1.5, lead=0.8, tail=0.9)
    y = audio.trim_silence(x, SR)
    assert 1.5 <= len(y) / SR <= 2.1, "silence around the speech is trimmed, a little air is kept (%.2f s)" % (len(y) / SR)
    z, _gain, lufs = audio.match_loudness(y, SR, trim_db=0.0)
    assert abs(audio.lufs(z, SR) - audio.TARGET_LUFS) < 0.8, "integrated loudness lands on target"
    z2, _, _ = audio.match_loudness(y, SR, trim_db=-3.0)
    assert abs((audio.lufs(z, SR) - audio.lufs(z2, SR)) - 3.0) < 0.6, "voice trim shifts loudness by that many dB"
    assert audio.peak_db(z) <= audio.PEAK_CEILING_DB + 0.3, "peaks stay under the limiter ceiling"


@test
def mp3_roundtrip_and_envelope():
    x = audio.match_loudness(audio.trim_silence(speechlike(2.4), SR), SR)[0]
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "t.mp3"
        audio.encode_mp3(x, SR, p, 32)
        assert mf.mp3_looks_valid(str(p), len(x) / SR)
        dec = audio.decode_audio(p)
        assert abs(len(dec) - len(x)) / SR < 0.06, "decoded length matches within an MP3 frame or two"
        assert os.path.getsize(p) < 12000, "32 kbps of 2.4 s is small"
        p.write_bytes(p.read_bytes()[:60])
        assert not mf.mp3_looks_valid(str(p), len(x) / SR), "a truncated file is caught"
        env = audio.envelope_hex(dec, SR)
        assert abs(len(env) - round(len(dec) / SR * 20)) <= 1 and set(env) <= set("0123456789abcdef")
        assert "f" in env, "the loudest sample of the clip is f"


@test
def gate_scoring():
    voice = {"target": {"f0": [100, 150], "wps": [2.0, 3.0]}}
    text = "one two three four five six"
    perfect = stt.score(text, text)
    good = speechlike(2.4, f0=122.0)  # 6 words in 2.4 s is 2.5 words/s, F0 inside the band
    a = qa.assess(good, SR, text, voice, perfect, False)
    assert a.ok and not any("F0" in p for p in a.problems), a.problems
    off = qa.assess(speechlike(2.4, f0=210.0), SR, text, voice, perfect, False)
    assert any("F0" in p for p in off.problems) and off.badness > a.badness, "a different register is penalised"
    assert qa.assess(good, SR, text, voice, stt.score(text, "nothing like it at all"), False).badness >= qa.HARD, "WER is a hard failure"
    assert qa.assess(good, SR, text, voice, perfect, True).badness >= qa.HARD, "hitting the token cap is a hard failure"
    clipped = np.clip(speechlike(2.4, f0=122.0) * 8.0, -1.0, 1.0)
    assert any("clipped" in p for p in qa.assess(clipped, SR, text, voice, perfect, False).problems)
    assert any("rushed" in p for p in qa.assess(speechlike(0.4), SR, text, voice, perfect, False).problems)
    assert any("dragged" in p for p in qa.assess(speechlike(20.0), SR, text, voice, perfect, False).problems)
    # a delivery note widens the band: the same off-band take costs less
    exp = qa.assess(speechlike(2.4, f0=170.0), SR, text, voice, perfect, False, expressive=True)
    plain = qa.assess(speechlike(2.4, f0=170.0), SR, text, voice, perfect, False, expressive=False)
    assert exp.badness < plain.badness
    # no target: nothing to pull toward, a clean take is excellent at once
    assert qa.assess(good, SR, text, {}, perfect, False).excellent


@test
def manifest_files():
    m = {"version": 1, "voices": {"dave": {"name": "Dave"}}, "lines": {
        "dave-f3434638": {"voice": "dave", "text": "Hi.", "file": "dave-f3434638.mp3", "dur": 1.0, "env": "0123", "words": [[0.0, 0.5]], "wer": 0.0}}}
    text = mf.dump_manifest(m)
    assert json.loads(text) == m
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "sub", "manifest.json")
        mf.save_manifest(p, m)
        assert mf.load_manifest(p) == m
        assert (os.stat(p).st_mode & 0o777) == 0o644
        assert [n for n in os.listdir(os.path.dirname(p)) if n != "manifest.json"] == [], "no temp files left behind"
        sp = os.path.join(d, "state.json")
        mf.save_state(sp, {"version": 1, "lines": {"a-00000000": {"f0": 1.0}}})
        assert mf.load_state(sp)["lines"]["a-00000000"]["f0"] == 1.0


@test
def needs_polish_rules():
    import generate

    voice = {"target": {"f0": [100, 150]}}
    assert not generate.needs_polish({"bad": 0.2, "f0": 120}, voice, {})
    assert generate.needs_polish({"bad": 1.5, "f0": 120}, voice, {}), "a weak take is polished even inside the band"
    assert generate.needs_polish({"bad": 0.2, "f0": 200}, voice, {}), "far outside the band"
    assert generate.needs_polish({"bad": 0.2, "f0": 160}, voice, {}), "a little outside, no delivery note"
    assert not generate.needs_polish({"bad": 0.2, "f0": 160}, voice, {"delivery": "tired"}), "a delivery note widens the band"
    assert not generate.needs_polish({"bad": 5.0, "f0": 200, "polish": generate.MAX_POLISH_ROUNDS}, voice, {}), "gives up after the last round"
    assert not generate.needs_polish({"bad": 0.2, "f0": 0.0}, voice, {}), "no pitch measured, nothing to compare with"


def main() -> int:
    failed = 0
    for fn in TESTS:
        try:
            fn()
            print("ok    ", fn.__name__)
        except Exception:  # noqa: BLE001
            failed += 1
            print("FAIL  ", fn.__name__)
            traceback.print_exc()
    print("\n%d tests, %d failed" % (len(TESTS), failed))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
