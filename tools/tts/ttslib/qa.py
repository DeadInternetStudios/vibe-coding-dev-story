"""Is this take good? Hard failures first, then whether it still sounds like the voice.

VoiceDesign invents a new speaker on every call, so a take is also checked against the voice's
intent band in voices.json (`target`: F0 median band, speaking rate band, optional F0 spread
band). A take outside the band is a different person or a different mood, and is retried with
another seed. All numbers are measured on the decoded MP3, the file the game will load.

`badness` is one number to compare takes: 0 is perfect, anything under 1 is accepted, 100 or more
is a hard failure (capped, unintelligible, clipped, absurd duration).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import audio, stt

ACCEPT_WER = 0.25
HARD = 100.0
MIN_VOICED_SEC = 0.5  # below this the F0 numbers are noise, skip the identity gate
BAND_SLACK_ST = 0.5  # semitones outside the F0 band that still count as inside


@dataclass
class Assessment:
    wer: float
    missing: int
    extra: int
    heard: str
    dur: float
    metrics: dict
    capped: bool
    problems: list = field(default_factory=list)
    badness: float = 0.0

    @property
    def ok(self) -> bool:
        return self.badness < 1.0


def _st(a: float, b: float) -> float:
    return abs(12.0 * np.log2(max(a, 1e-6) / max(b, 1e-6)))


def assess(decoded: np.ndarray, sr: int, text: str, voice: dict, sc: stt.Score, capped: bool,
           accept_wer: float = ACCEPT_WER) -> Assessment:
    m = audio.measure(decoded, sr, text)
    words = len(text.split())
    problems: list = []
    bad = 0.0

    if capped:
        bad += HARD
        problems.append("capped: ran to the token limit (rambling or looping)")
    if sc.wer > accept_wer:
        bad += HARD
        problems.append("wer %.2f > %.2f heard %r" % (sc.wer, accept_wer, sc.hyp_text[:70]))
    if m["clip"] >= 0.0005:
        bad += HARD
        problems.append("clipped %.4f of samples" % m["clip"])
    if m["dur"] < 0.12 * words:
        bad += HARD
        problems.append("rushed: %.2fs for %d words" % (m["dur"], words))
    if m["dur"] > 2.2 * words + 1.5:
        bad += HARD
        problems.append("dragged: %.2fs for %d words" % (m["dur"], words))

    max_gap = float(voice.get("max_gap", 2.4))
    if m["sil_max_gap"] > max_gap:
        bad += 1.5
        problems.append("long pause %.2fs > %.1fs" % (m["sil_max_gap"], max_gap))
    if sc.extra >= 1 and sc.wer <= accept_wer:
        bad += 0.3
        problems.append("extra words heard: %r" % sc.hyp_text[:70])

    target = voice.get("target") or {}
    voiced_sec = m["dur"] * m["voiced_frac"]
    if "f0" in target and voiced_sec >= MIN_VOICED_SEC and m["f0_med"] > 0:
        lo, hi = target["f0"]
        d = _st(lo, m["f0_med"]) if m["f0_med"] < lo else (_st(m["f0_med"], hi) if m["f0_med"] > hi else 0.0)
        if d > BAND_SLACK_ST:
            bad += d
            problems.append("F0 %.0f Hz is %.1f st outside %d-%d" % (m["f0_med"], d, lo, hi))
        if "f0_std_st" in target and m["f0_std_st"] > 0:
            slo, shi = target["f0_std_st"]
            sd = max(0.0, slo - m["f0_std_st"], m["f0_std_st"] - shi)
            if sd > 0.7:
                bad += 0.5 * sd
                problems.append("F0 spread %.1f st outside %.1f-%.1f" % (m["f0_std_st"], slo, shi))
    if "wps" in target and words >= 4:
        lo, hi = target["wps"]
        wps = m["wps"]
        rel = (lo - wps) / lo if wps < lo else ((wps - hi) / hi if wps > hi else 0.0)
        if rel > 0.1:
            bad += 6.0 * rel
            problems.append("rate %.2f words/s outside %.1f-%.1f" % (wps, lo, hi))

    bad += 5.0 * sc.wer
    return Assessment(wer=sc.wer, missing=sc.missing, extra=sc.extra, heard=sc.hyp_text, dur=m["dur"],
                      metrics=m, capped=capped, problems=problems, badness=round(bad, 3))
