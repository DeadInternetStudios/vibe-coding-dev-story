#!/usr/bin/env python3
"""
Measure every rendered sound and write the numbers and pictures.

Reads   tools/audio/out/wav/<group>/<name>.wav + <name>.json  (see render.ts)
Writes  tools/audio/out/analysis.json
        tools/audio/out/png/<group>/<name>.png          one spectrogram per file
        tools/audio/out/png/family/<family>.png         one per sfx family
        docs/audio-notes.md                             tables between AUTO markers

Run with the venv:  tools/audio/.venv/bin/python tools/audio/analyze.py

QUIET MACHINE: this only reads WAV files. It never plays anything.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import ndimage, signal
from scipy.io import wavfile

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FFMPEG = "/opt/homebrew/bin/ffmpeg"

CEILING_DBFS = 20 * math.log10(0.708)  # the engine's hard limiter ceiling, about -3.0
MUSIC_TARGET_LUFS = -18.0
# Win and lose play once and interrupt the bed music, so they sit 2 LU hotter than the loops.
STINGER_TARGET_LUFS = MUSIC_TARGET_LUFS + 2.0
SFX_TARGET_LUFS = -14.0
SILENCE_DBFS = -60.0

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Krumhansl-Kessler key profiles
KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

FLAT_TO_SHARP = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}


# ----------------------------------------------------------------------------- io


def load(path: Path) -> tuple[int, np.ndarray]:
    sr, data = wavfile.read(path)
    data = data.astype(np.float64)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1)
    return sr, data


def db(x: float, floor: float = -200.0) -> float:
    return max(20.0 * math.log10(max(float(x), 1e-12)), floor)


# ------------------------------------------------------------------- loudness


def _shelf(sr: int):
    G, Q, fc = 3.999843853973347, 0.7071752369554196, 1681.974450955533
    K = math.tan(math.pi * fc / sr)
    Vh = 10 ** (G / 20)
    Vb = Vh**0.499666774155
    a0 = 1.0 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2.0 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0]
    return b, a


def _highpass(sr: int):
    Q, fc = 0.5003270373238773, 38.13547087602444
    K = math.tan(math.pi * fc / sr)
    a0 = 1.0 + K / Q + K * K
    b = [1.0 / a0, -2.0 / a0, 1.0 / a0]
    a = [1.0, 2.0 * (K * K - 1.0) / a0, (1.0 - K / Q + K * K) / a0]
    return b, a


def k_weight(x: np.ndarray, sr: int) -> np.ndarray:
    """ITU-R BS.1770 K-weighting: high shelf then 38 Hz high pass."""
    b1, a1 = _shelf(sr)
    b2, a2 = _highpass(sr)
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)


def event_lufs(data: np.ndarray, sr: int) -> tuple[float, float]:
    """
    Loudness of the part of a short sound you actually hear.
    BS.1770 gating needs 400 ms, so for effects we K-weight the sound, cut it
    into 10 ms frames, drop frames more than 35 dB under the loudest, and take
    the mean power of what is left. Returns (LUFS-event, active seconds).
    """
    k = k_weight(data, sr)
    hop = max(int(sr * 0.01), 1)
    n = (len(k) // hop) * hop
    if n == 0:
        return -120.0, 0.0
    frames = (k[:n] ** 2).reshape(-1, hop, k.shape[1]).mean(axis=1).sum(axis=1)  # sum channels
    peak = frames.max()
    if peak <= 0:
        return -120.0, 0.0
    keep = frames >= peak * 10 ** (-35 / 10)
    ms = frames[keep].mean()
    return -0.691 + 10 * math.log10(ms), float(keep.sum() * 0.01)


def ffmpeg_ebur128(path: Path) -> dict:
    """Integrated loudness, loudness range and true peak from ffmpeg's ebur128 filter."""
    cmd = [FFMPEG, "-hide_banner", "-nostats", "-i", str(path), "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]
    p = subprocess.run(cmd, capture_output=True, text=True)
    txt = p.stderr
    summary = txt[txt.rfind("Summary:") :] if "Summary:" in txt else ""

    def grab(rx: str) -> float | None:
        m = re.search(rx, summary)
        if not m or m.group(1) == "-inf":
            return None
        return float(m.group(1))

    return {
        "lufs_i": grab(r"I:\s+(-?[\d.]+|-inf)\s+LUFS"),
        "lra": grab(r"LRA:\s+([\d.]+)\s+LU"),
        "true_peak": grab(r"Peak:\s+(-?[\d.]+|-inf)\s+dBFS"),
    }


# ------------------------------------------------------------------- spectrum


def ebur128_of(data: np.ndarray, sr: int) -> float | None:
    """Integrated loudness (LUFS) of an array, measured by ffmpeg like a file would be."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "segment.wav"
        wavfile.write(path, sr, data.astype(np.float32))
        return ffmpeg_ebur128(path).get("lufs_i")


def stft_power(mono: np.ndarray, sr: int, nfft: int, hop: int):
    f, t, z = signal.stft(mono, fs=sr, nperseg=nfft, noverlap=nfft - hop, window="hann", boundary=None, padded=False)
    return f, t, np.abs(z)


def spectral_features(mono: np.ndarray, sr: int, nfft: int = 2048) -> dict:
    hop = nfft // 4
    if len(mono) < nfft:
        mono = np.pad(mono, (0, nfft - len(mono)))
    f, _t, mag = stft_power(mono, sr, nfft, hop)
    power = mag**2
    energy = power.sum(axis=0)
    if energy.max() <= 0:
        return {"centroid": 0.0, "roll85": 0.0, "roll95": 0.0, "hf6k": 0.0, "bass_pct": 0.0}
    act = energy > energy.max() * 1e-6
    cent = (f[:, None] * power).sum(axis=0) / np.maximum(energy, 1e-30)
    centroid = float(np.average(cent[act], weights=energy[act]))
    p = power[:, act].sum(axis=1)
    c = np.cumsum(p) / p.sum()
    roll85 = float(f[min(np.searchsorted(c, 0.85), len(f) - 1)])
    roll95 = float(f[min(np.searchsorted(c, 0.95), len(f) - 1)])
    return {
        "centroid": centroid,
        "roll85": roll85,
        "roll95": roll95,
        "hf6k": float(p[f >= 6000].sum() / p.sum() * 100),
        "bass_pct": float(p[f < 200].sum() / p.sum() * 100),
    }


def detect_tempo(mono: np.ndarray, sr: int, lo: float = 70.0, hi: float = 190.0) -> dict:
    """Onset envelope autocorrelation with a comb over the first four beat multiples."""
    nfft, hop = 1024, 256
    f, _t, mag = stft_power(mono, sr, nfft, hop)
    band = (f > 60) & (f < 8000)
    lm = np.log1p(30.0 * mag[band])
    flux = np.maximum(np.diff(lm, axis=1), 0).sum(axis=0)
    flux = flux - signal.lfilter([1 / 20.0] * 20, [1], flux)  # remove the slow trend
    flux = np.maximum(flux, 0)
    if flux.max() <= 0:
        return {"bpm": None, "strength": 0.0}
    fps = sr / hop
    n = len(flux)
    ac = signal.correlate(flux, flux, mode="full", method="fft")[n - 1 :]
    ac = ac / ac[0]
    best, best_score = None, -1.0
    for bpm in np.arange(lo, hi, 0.25):
        lag = fps * 60.0 / bpm
        score = 0.0
        for k, w in ((1, 1.0), (2, 0.8), (3, 0.6), (4, 0.8)):
            idx = lag * k
            if idx + 1 >= len(ac):
                break
            i0 = int(idx)
            score += w * (ac[i0] * (1 - (idx - i0)) + ac[i0 + 1] * (idx - i0))
        if score > best_score:
            best, best_score = float(bpm), float(score)
    return {"bpm": best, "strength": best_score}


def tempo_match(declared: float, detected: float | None) -> str:
    if detected is None:
        return "none"
    for ratio, label in ((1, "ok"), (2, "x2"), (0.5, "x0.5"), (1.5, "x1.5"), (2 / 3, "x2/3")):
        if abs(detected - declared * ratio) / (declared * ratio) < 0.03:
            return label
    return "MISMATCH"


def pitch_chroma(mono: np.ndarray, sr: int, fmin: float = 130.0, fmax: float = 2100.0) -> np.ndarray:
    """
    A chroma vector (12 pitch classes, sums to 1) built to ignore drums and noise:
    the spectrogram is split into a harmonic part (steady along time) and a percussive part
    (steady along frequency) by median filtering, and only bins within 30 cents of a
    semitone centre are counted, so spectral splatter between notes does not vote.
    """
    nfft, hop = 16384, 4096
    if len(mono) < nfft:
        mono = np.pad(mono, (0, nfft - len(mono)))
    f, _t, mag = stft_power(mono, sr, nfft, hop)
    harm = ndimage.median_filter(mag, size=(1, 9))
    perc = ndimage.median_filter(mag, size=(25, 1))
    mask = harm**2 / (harm**2 + perc**2 + 1e-20)
    tonal = mag * mask
    sel = (f >= fmin) & (f <= fmax)
    semis = 12 * np.log2(f[sel] / 440.0) + 69
    near = np.abs(semis - np.round(semis)) < 0.3
    pc = np.round(semis).astype(int) % 12
    weights = np.sqrt(tonal[sel].sum(axis=1))  # square root: a few loud bins do not outvote the rest
    chroma = np.zeros(12)
    np.add.at(chroma, pc[near], weights[near])
    return chroma / chroma.sum() if chroma.sum() > 0 else chroma


def detect_key(mono: np.ndarray, sr: int) -> dict:
    chroma = pitch_chroma(mono, sr)
    if chroma.sum() <= 0:
        return {"key": None, "score": 0.0, "top3": [], "ranked": []}
    scores = []
    for tonic in range(12):
        for mode, prof in (("major", KS_MAJOR), ("minor", KS_MINOR)):
            r = np.corrcoef(chroma, np.roll(prof, tonic))[0, 1]
            scores.append((float(r), f"{NOTE_NAMES[tonic]} {mode}"))
    scores.sort(reverse=True)
    return {"key": scores[0][1], "score": scores[0][0], "top3": [s[1] for s in scores[:3]], "ranked": [s[1] for s in scores]}


def norm_key(k: str) -> str:
    m = re.match(r"^([A-G][#b]?)\s+(major|minor)$", k)
    if not m:
        return k
    root = FLAT_TO_SHARP.get(m.group(1), m.group(1))
    return f"{root} {m.group(2)}"


def relative_key(k: str) -> str | None:
    m = re.match(r"^([A-G]#?)\s+(major|minor)$", k)
    if not m:
        return None
    i = NOTE_NAMES.index(m.group(1))
    if m.group(2) == "major":
        return f"{NOTE_NAMES[(i + 9) % 12]} minor"
    return f"{NOTE_NAMES[(i + 3) % 12]} major"


# A pulse wave's upper partials smear a chroma, and loops like I vi ii V lean on the relative minor,
# so a key finder cannot be strict. The declared key must still rank in the better third of the 24
# candidates; a wrong key or a transposition lands far below that. The data tests check the notes themselves.
KEY_RANK_OK = 8
# A non looping song shorter than this is a stinger: tempo and key are not measured.
SHORT_STINGER_SEC = 8.0
# the seam step may be at most this many times the 99th percentile step of the loop itself
SEAM_CLICK_MAX = 1.5


def key_rank(declared: str, det: dict) -> int | None:
    ranked = det.get("ranked") or []
    d = norm_key(declared)
    return ranked.index(d) + 1 if d in ranked else None


def key_match(declared: str, det: dict) -> str:
    if not det.get("key"):
        return "none"
    d = norm_key(declared)
    if det["key"] == d:
        return "ok"
    if d in det["top3"]:
        return "top3"
    if det["key"] == relative_key(d):
        return "relative"
    rank = key_rank(declared, det)
    if rank is not None and rank <= KEY_RANK_OK:
        return f"rank {rank}"
    return "MISMATCH"


# ---------------------------------------------------------------------- seam


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x**2))) if len(x) else 0.0


def loop_seam(mono: np.ndarray, sr: int, meta: dict, start: float = 0.06) -> dict | None:
    """
    How clean is the jump from the end of the loop back to the start?
    The engine loops by scheduling, so there is no file seam, but the notes at the
    loop point are scheduled just like any bar line. We compare the loop point
    with the other bar lines: sample step size, and loudness just before vs after.
    """
    loop = float(meta.get("loopSeconds") or 0)
    bar = float(meta.get("barSeconds") or 0)
    if not meta.get("loop") or loop <= 0 or bar <= 0:
        return None
    seams = [start + k * loop for k in range(1, 9) if start + k * loop + 0.1 < len(mono) / sr]
    if not seams:
        return None
    w = max(int(0.002 * sr), 2)
    h = int(0.05 * sr)

    def step(t: float) -> float:
        i = int(round(t * sr))
        seg = mono[max(i - w, 0) : i + w]
        return float(np.max(np.abs(np.diff(seg)))) if len(seg) > 1 else 0.0

    def jump_db(t: float) -> float:
        # silence on one side is a jump of "a lot", not of infinity
        i = int(round(t * sr))
        a, b = rms(mono[max(i - h, 0) : i]), rms(mono[i : i + h])
        return float(np.clip(db(b + 1e-5) - db(a + 1e-5), -60.0, 60.0))

    total = len(mono) / sr
    bars = []
    j = 1
    while start + j * bar + 0.1 < total and j < 400:
        t = start + j * bar
        if all(abs(t - s) > 0.01 for s in seams):
            bars.append(t)
        j += 1
    bar_jumps = [jump_db(t) for t in bars] or [0.0]
    seam_steps = [step(t) for t in seams]
    seam_jumps = [jump_db(t) for t in seams]

    # A click is a sample step bigger than anything the loop does anywhere else, so the
    # yardstick is the 99th percentile of the largest step in every 4 ms window of one loop.
    # (Bar lines themselves can be silent before a note, so they make a poor yardstick.)
    second = start + loop
    first_t = second if second + loop <= total + 0.05 else start
    lo = int(round(first_t * sr))
    one_loop = mono[lo : lo + int(round(loop * sr))]
    win = max(int(0.004 * sr), 4)
    n = len(one_loop) // win * win
    window_steps = np.abs(np.diff(one_loop[:n].reshape(-1, win), axis=1)).max(axis=1) if n else np.array([1e-9])
    typical_max = float(np.percentile(window_steps, 99)) + 1e-9

    out = {
        "seam_click_ratio": max(seam_steps) / typical_max,
        "seam_step_db": max(seam_jumps, key=abs),
        "bar_step_db_median": float(np.median(bar_jumps)),
        "bar_step_db_spread": float(np.std(bar_jumps)),
    }
    # what a pre-rendered file of exactly one loop would do if it were looped
    if len(seams) >= 2:
        a, b = int(round(seams[0] * sr)), int(round(seams[1] * sr))
        one = mono[a:b]
        typical = float(np.median(np.abs(np.diff(one)))) + 1e-9
        out["wrap_jump_ratio"] = float(abs(one[-1] - one[0]) / typical)
        out["wrap_jump_abs"] = float(abs(one[-1] - one[0]))
    # does loop 2 repeat loop 1? compare their loudness envelopes and low band waveforms
    edges = [start] + seams
    if len(edges) >= 3:
        a, b, c = (int(round(e * sr)) for e in edges[:3])
        l1, l2 = mono[a:b], mono[b:c]
        n = min(len(l1), len(l2))
        fr = max(int(0.01 * sr), 1)
        e1 = np.sqrt((l1[: n // fr * fr].reshape(-1, fr) ** 2).mean(axis=1))
        e2 = np.sqrt((l2[: n // fr * fr].reshape(-1, fr) ** 2).mean(axis=1))
        out["loop_env_corr"] = float(np.corrcoef(e1, e2)[0, 1])
        sos = signal.butter(4, 1200, btype="low", fs=sr, output="sos")
        b1, b2 = signal.sosfilt(sos, l1[:n]), signal.sosfilt(sos, l2[:n])
        out["loop_low_corr"] = float(np.corrcoef(b1, b2)[0, 1])
    return out


# --------------------------------------------------------------------- basics


DROPOUT_SOUND_DBFS = -60.0
DROPOUT_SILENCE_DBFS = -80.0
GAP_MAX_MS = 150.0


def longest_dropout_ms(mono: np.ndarray, sr: int) -> float:
    """Longest stretch of near digital silence between the first and the last sound, in ms.

    A full mix has a note, a hat or a decaying tail sounding at every moment, so a long
    hole in it is a render that lost audio (a missed scheduler pump), not a rest.
    """
    hop = max(int(0.01 * sr), 1)
    n = len(mono) // hop * hop
    if n == 0:
        return 0.0
    frames = np.sqrt((mono[:n].reshape(-1, hop) ** 2).mean(axis=1))
    sound = np.flatnonzero(frames > 10 ** (DROPOUT_SOUND_DBFS / 20))
    if len(sound) < 2:
        return 0.0
    inner = frames[sound[0] : sound[-1] + 1] >= 10 ** (DROPOUT_SILENCE_DBFS / 20)
    # distance between consecutive sounding frames, with sentinels at both ends
    marks = np.flatnonzero(np.concatenate(([True], inner, [True])))
    return float((np.diff(marks).max() - 1) * hop / sr * 1000)


def basic_metrics(data: np.ndarray, sr: int) -> dict:
    mono = data.mean(axis=1)
    peak = float(np.abs(data).max())
    finite = bool(np.isfinite(data).all())
    thr = 10 ** (SILENCE_DBFS / 20)
    nz = np.flatnonzero(np.abs(mono) > thr)
    if len(nz):
        lead = float(nz[0] / sr)
        trail = float((len(mono) - 1 - nz[-1]) / sr)
        active = float((nz[-1] - nz[0]) / sr)
    else:
        lead, trail, active = len(mono) / sr, len(mono) / sr, 0.0
    hop = int(0.05 * sr)
    n = len(mono) // hop * hop
    fr = np.sqrt((mono[:n].reshape(-1, hop) ** 2).mean(axis=1)) if n else np.array([0.0])
    silent_frac = float((fr < thr).mean())
    return {
        "max_gap_ms": longest_dropout_ms(mono, sr),
        "duration": len(mono) / sr,
        "finite": finite,
        "peak_db": db(peak),
        "rms_db": db(rms(data)),
        "rms_active_db": db(rms(mono[nz[0] : nz[-1] + 1])) if len(nz) else -200.0,
        "clip_count": int((np.abs(data) >= 0.999).sum()),
        "over_ceiling": int((np.abs(data) > 0.7085).sum()),
        "dc": float(np.abs(data.mean(axis=0)).max()),
        "lead_silence": lead,
        "trail_silence": trail,
        "active_sec": active,
        "silent_frac": silent_frac,
    }


# ---------------------------------------------------------------- spectrogram


def spectrogram_image(mono: np.ndarray, sr: int, title: str, path: Path, nfft: int, marks: list[tuple[float, str]] | None = None, width: float = 11.0) -> None:
    hop = nfft // 4
    if len(mono) < nfft:
        mono = np.pad(mono, (0, nfft - len(mono)))
    f, t, mag = stft_power(mono, sr, nfft, hop)
    s = 20 * np.log10(mag + 1e-9)
    s = s - s.max()
    fig, ax = plt.subplots(figsize=(width, 3.6), dpi=100)
    ax.pcolormesh(t, f[1:], s[1:], shading="auto", cmap="magma", vmin=-90, vmax=0)
    ax.set_yscale("log")
    ax.set_ylim(40, 16000)
    ax.set_yticks([50, 100, 200, 500, 1000, 2000, 5000, 10000])
    ax.set_yticklabels(["50", "100", "200", "500", "1k", "2k", "5k", "10k"])
    ax.set_xlabel("seconds")
    ax.set_ylabel("Hz")
    ax.set_title(title, fontsize=9)
    if marks:
        for x, label in marks:
            ax.axvline(x, color="white", alpha=0.25, lw=0.6)
            ax.text(x + 0.01, 15000, label, color="white", fontsize=6, rotation=90, va="top", ha="left")
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path)
    plt.close(fig)


# ----------------------------------------------------------------- piano roll

DRUM_ROWS = ["kick", "snare", "hat", "ohat", "tom", "clap", "rim", "shaker", "crash", "cowbell", "riser"]
TRACK_COLORS = ["#4c78a8", "#f58518", "#54a24b", "#e45756", "#b279a2", "#9d755d", "#72b7b2", "#eeca3b", "#ff9da6", "#bab0ac"]


def piano_roll(song: dict, path: Path) -> None:
    """Notes of every layer over bars, harmony underneath. For looking at contour, density and layering."""
    spb = song["stepsPerBar"]
    bars = song["bars"]
    pitched = [t for t in song["tracks"] if t["inst"] != "drums"]
    drums = [t for t in song["tracks"] if t["inst"] == "drums"]
    lo = min((n["pitch"] for t in pitched for n in t["notes"]), default=36)
    hi = max((n["pitch"] for t in pitched for n in t["notes"]), default=84)
    fig = plt.figure(figsize=(max(11.0, bars * 0.55), 7.2), dpi=100)
    gs = fig.add_gridspec(2, 1, height_ratios=[4, 1], hspace=0.08)
    ax = fig.add_subplot(gs[0])
    for i, t in enumerate(pitched):
        col = TRACK_COLORS[i % len(TRACK_COLORS)]
        for n in t["notes"]:
            ax.add_patch(plt.Rectangle((n["step"] / spb, n["pitch"] - 0.4), n["dur"] / spb, 0.8, color=col, alpha=0.35 + 0.65 * n["vel"], lw=0))
        ax.plot([], [], color=col, lw=6, label=f"{t['id']} ({t['inst']}, on from {t['at']:g})")
    for b in range(bars + 1):
        ax.axvline(b, color="black", alpha=0.35 if b % 4 == 0 else 0.12, lw=0.8 if b % 4 == 0 else 0.5)
    ax.set_xlim(0, bars)
    ax.set_ylim(lo - 2, hi + 3)
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    ticks = [m for m in range(int(lo) - 1, int(hi) + 3) if m % 12 == 0 or m % 12 == 7]
    ax.set_yticks(ticks)
    ax.set_yticklabels([f"{names[m % 12]}{m // 12 - 1}" for m in ticks], fontsize=7)
    ax.set_xticks(range(0, bars + 1, 4))
    ax.tick_params(labelbottom=False)
    ax.legend(loc="upper right", fontsize=6, ncol=2, framealpha=0.85)
    ax.set_title(f"{song['id']}  {song['key']}  {song['bpm']} bpm  {bars} bars  swing {song.get('swing', 0)}", fontsize=9)
    for b, chord in enumerate(song["harmony"]):
        parts = chord.split(",")
        for k, c in enumerate(parts):
            ax.text(b + k / len(parts) + 0.03, hi + 2.2, c, fontsize=6, color="#333", va="center")
    ax2 = fig.add_subplot(gs[1], sharex=ax)
    rows = {name: i for i, name in enumerate(DRUM_ROWS)}
    for t in drums:
        for n in t["notes"]:
            ax2.plot([n["step"] / spb, n["step"] / spb], [rows[n["drum"]] - 0.35, rows[n["drum"]] + 0.35], color="#333", alpha=0.3 + 0.7 * n["vel"], lw=1.2)
    ax2.set_yticks(range(len(DRUM_ROWS)))
    ax2.set_yticklabels(DRUM_ROWS, fontsize=6)
    ax2.set_xlim(0, bars)
    ax2.set_xticks(range(0, bars + 1, 4))
    ax2.set_xlabel("bar")
    for b in range(0, bars + 1, 4):
        ax2.axvline(b, color="black", alpha=0.25, lw=0.8)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


# ----------------------------------------------------------------------- main


def analyze_file(wav: Path, meta: dict, out_png: Path) -> dict:
    sr, data = load(wav)
    mono = data.mean(axis=1)
    res: dict = {"name": meta.get("name", wav.stem), "group": meta.get("group"), "label": meta.get("label"), "family": meta.get("family"), "sr": sr}
    res["trim_db"] = float(meta.get("trimDb") or 0.0)
    res["level"] = float(meta.get("level") or 0.0)
    res["loops"] = bool(meta.get("loop"))
    res.update(basic_metrics(data, sr))
    res.update(spectral_features(mono, sr, 2048 if meta.get("group") != "sfx" else 1024))
    kind = meta.get("kind")
    if "#" in res["name"]:
        # a layer (or a few) rendered alone: loudness and peak are all we want from it
        res["solo"] = True
        res.update(ffmpeg_ebur128(wav))
        return res
    if kind == "music" or meta.get("group") == "music":
        eb = ffmpeg_ebur128(wav)
        res.update(eb)
        tempo = detect_tempo(mono, sr)
        res["tempo_detected"] = tempo["bpm"]
        res["tempo_declared"] = meta.get("bpm")
        res["tempo_match"] = tempo_match(float(meta.get("bpm") or 0), tempo["bpm"]) if meta.get("bpm") else "none"
        key = detect_key(mono, sr)
        res["key_detected"] = key["key"]
        res["key_declared"] = meta.get("key")
        res["key_match"] = key_match(str(meta.get("key")), key) if meta.get("key") else "none"
        res["key_rank"] = key_rank(str(meta.get("key")), key) if meta.get("key") else None
        res["key_score"] = key["score"]
        if not meta.get("loop") and len(mono) / sr < SHORT_STINGER_SEC:
            # a few notes have no tempo or key worth measuring
            res["tempo_match"] = "short"
            res["key_match"] = "short"
        seam = loop_seam(mono, sr, meta)
        if seam:
            res.update(seam)
        res["lufs_target"] = MUSIC_TARGET_LUFS if meta.get("loop") else STINGER_TARGET_LUFS
        # music loudness is judged on one whole loop once it has settled: loop 2, or loop 1 if only one was rendered
        loop = float(meta.get("loopSeconds") or 0)
        total = len(mono) / sr
        if loop > 0 and meta.get("loop"):
            for k in (1, 0):
                t0 = 0.06 + k * loop
                if t0 + loop <= total + 0.05:
                    a, b = int(t0 * sr), int(min((t0 + loop) * sr, len(mono)))
                    seg = data[a:b]
                    res["lufs_loop"] = ebur128_of(seg, sr)
                    res["peak_loop_db"] = db(np.abs(seg).max())
                    # how often is the soft knee of the limiter (it starts at -6 dBFS) in play? 95% of 10 ms frames sit below this
                    fr = max(int(0.01 * sr), 1)
                    peaks = np.abs(seg).max(axis=1)
                    nfr = len(peaks) // fr * fr
                    res["peak_p95_db"] = db(float(np.percentile(peaks[:nfr].reshape(-1, fr).max(axis=1), 95)))
                    break
    else:
        lufs, act = event_lufs(data, sr)
        res["lufs_event"] = lufs
        res["lufs_target"] = SFX_TARGET_LUFS + res["level"]
        res["active_gate_sec"] = act
    title = f"{res['name']}  peak {res['peak_db']:.1f} dBFS"
    if "lufs_i" in res and res["lufs_i"] is not None:
        title += f"  {res['lufs_i']:.1f} LUFS"
    if "lufs_event" in res:
        title += f"  {res['lufs_event']:.1f} LUFS-event"
    spectrogram_image(mono, sr, title, out_png, 2048 if kind == "music" else 512, width=11.0 if kind == "music" else 7.0)
    return res


def flags_for(r: dict) -> list[str]:
    if r.get("solo"):
        return []
    fl: list[str] = []
    if not r["finite"]:
        fl.append("NaN")
    if r["clip_count"] > 0:
        fl.append("CLIP")
    if r["peak_db"] > CEILING_DBFS + 0.15:
        fl.append("PEAK>-3")
    # A decaying sub 100 Hz thump never finishes its last cycle and averages to about
    # 1% of its rms: residue, not DC. Real DC averages to tens of percent.
    if r["dc"] > min(0.01, max(0.002, 0.02 * 10 ** (r["rms_db"] / 20))):
        fl.append("DC")
    if r["group"] == "music":
        # a loop is judged on one settled loop, a stinger (no loop) on the whole file, each against its own target
        li = r.get("lufs_loop") if r.get("lufs_loop") is not None else r.get("lufs_i")
        target = r.get("lufs_target", MUSIC_TARGET_LUFS)
        if li is not None and abs(li - target) > 2.0 and "@" not in r["name"]:
            fl.append(f"LUFS {li - target:+.1f}")
        if r.get("tempo_match") == "MISMATCH":
            fl.append("TEMPO")
        if r.get("key_match") in ("MISMATCH",):
            fl.append("KEY")
        if r.get("seam_click_ratio", 0) > SEAM_CLICK_MAX:
            fl.append("SEAM")
        if "@" not in r["name"] and r.get("max_gap_ms", 0) > GAP_MAX_MS:
            fl.append(f"GAP {r['max_gap_ms']:.0f}ms")
        if r.get("loop_env_corr") is not None and r["loop_env_corr"] < 0.9:
            fl.append("LOOP")
    elif r["group"] == "sfx":
        if abs(r["lufs_event"] - r["lufs_target"]) > 2.5:
            fl.append(f"LUFS {r['lufs_event'] - r['lufs_target']:+.1f}")
        if r["lead_silence"] > 0.02:
            fl.append("LATE")
        if r["hf6k"] > 12:
            fl.append("HARSH")
    return fl


def fmt(v, spec: str = ".1f", none: str = "-") -> str:
    return none if v is None else format(v, spec)


def music_table(rows: list[dict]) -> str:
    head = "| Song | BPM set/found | Key set/found | Bars | Loop s | LUFS-I | LUFS loop | Peak dBFS | TP dBTP | Centroid Hz | Roll-off 95% | Seam click x | Seam dB | Bar line dB | Loop corr | Flags |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n"
    lines = []
    for r in rows:
        lines.append(
            "| {n} | {bs}/{bf} {bm} | {ks}/{kf} {km} | {bars} | {loop} | {li} | {ll} | {pk} | {tp} | {ce} | {ro} | {sc} | {sd} | {bd} | {lc} | {fl} |".format(
                n=r["name"],
                bs=fmt(r.get("tempo_declared"), ".0f"),
                bf=fmt(r.get("tempo_detected"), ".0f"),
                bm=f"({r.get('tempo_match')})",
                ks=r.get("key_declared") or "-",
                kf=r.get("key_detected") or "-",
                km=f"({r.get('key_match')})",
                bars=r.get("bars", "-"),
                loop=fmt(r.get("loop_seconds"), ".1f"),
                li=fmt(r.get("lufs_i")),
                ll=fmt(r.get("lufs_loop")),
                pk=fmt(r["peak_db"]),
                tp=fmt(r.get("true_peak")),
                ce=fmt(r["centroid"], ".0f"),
                ro=fmt(r["roll95"], ".0f"),
                sc=fmt(r.get("seam_click_ratio"), ".2f"),
                sd=fmt(r.get("seam_step_db"), "+.1f"),
                bd=fmt(r.get("bar_step_db_median"), "+.1f"),
                lc=fmt(r.get("loop_env_corr"), ".3f"),
                fl=", ".join(flags_for(r)) or "ok",
            )
        )
    return head + "\n".join(lines) + "\n"


def sfx_table(rows: list[dict]) -> str:
    head = "| ID | Family | Dur s | Peak dBFS | LUFS-event | Centroid Hz | Roll-off 95% | >6 kHz % | DC | Flags |\n|---|---|---|---|---|---|---|---|---|---|\n"
    lines = []
    for r in rows:
        lines.append(
            "| {n} | {f} | {d} | {pk} | {lu} | {ce} | {ro} | {hf} | {dc} | {fl} |".format(
                n=r["name"],
                f=r.get("family"),
                d=fmt(r["active_sec"], ".2f"),
                pk=fmt(r["peak_db"]),
                lu=fmt(r["lufs_event"]),
                ce=fmt(r["centroid"], ".0f"),
                ro=fmt(r["roll95"], ".0f"),
                hf=fmt(r["hf6k"], ".1f"),
                dc=fmt(r["dc"], ".4f"),
                fl=", ".join(flags_for(r)) or "ok",
            )
        )
    return head + "\n".join(lines) + "\n"


# where each kind of layer should sit next to the lead, in LUFS dB (solo loudness)
LAYER_TARGET_REL = {"lead": 0.0, "bass": -3.0, "kit": -4.0, "drums": -4.0, "chords": -6.0, "base": -6.0, "pad": -3.0, "extra": -9.0, "perc": -9.0}


def layer_balance(solo_rows: list[dict]) -> list[dict]:
    """Per layer: loudness alone, distance from the lead, where its role wants it, and the volume factor that gets it there.

    tools/audio/rebalance.ts applies `change` to the song source, so the targets live only here.
    """
    by_song: dict[str, list[tuple[str, dict]]] = {}
    for r in solo_rows:
        song, layer = r["name"].split("#", 1)
        by_song.setdefault(song, []).append((layer, r))
    out: list[dict] = []
    for song, rows in sorted(by_song.items()):
        ref = next((r for layer, r in rows if layer == "lead"), None)
        ref_lufs = ref["lufs_i"] if ref and ref.get("lufs_i") is not None else max((r.get("lufs_i") or -99.0) for _, r in rows)
        for layer, r in sorted(rows, key=lambda x: x[0]):
            if r.get("lufs_i") is None:
                continue
            rel = r["lufs_i"] - ref_lufs
            want = LAYER_TARGET_REL.get(layer)
            out.append(
                {
                    "song": song,
                    "layer": layer,
                    "lufs_i": r["lufs_i"],
                    "peak_db": r["peak_db"],
                    "rel": rel,
                    "want": want,
                    "change": None if want is None else 10 ** ((want - rel) / 20),
                }
            )
    return out


def layers_table(balance: list[dict]) -> str:
    """The layer balance as a markdown table."""
    head = "| Song | Layer alone | LUFS-I | Peak dBFS | vs lead dB | wanted vs lead | change vol by |\n|---|---|---|---|---|---|---|\n"
    lines = []
    for b in balance:
        fix = "" if b["change"] is None else f"x{b['change']:.2f}"
        lines.append(f"| {b['song']} | {b['layer']} | {fmt(b['lufs_i'])} | {fmt(b['peak_db'])} | {fmt(b['rel'], '+.1f')} | {fmt(b['want'], '+.1f')} | {fix} |")
    return head + "\n".join(lines) + "\n"


def replace_block(text: str, name: str, body: str) -> str:
    begin, end = f"<!-- AUTO:BEGIN {name} -->", f"<!-- AUTO:END {name} -->"
    block = f"{begin}\n{body}{end}"
    if begin in text and end in text:
        return re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _m: block, text, flags=re.S)
    return text.rstrip() + "\n\n" + block + "\n"


def family_images(sfx_rows: list[dict], wav_dir: Path, png_dir: Path) -> None:
    by_family: dict[str, list[dict]] = {}
    for r in sfx_rows:
        by_family.setdefault(r.get("family") or "other", []).append(r)
    for fam, rows in by_family.items():
        chunks, marks, t = [], [], 0.0
        gap = 0.12
        sr0 = None
        for r in rows:
            sr, data = load(wav_dir / f"{r['name']}.wav")
            sr0 = sr0 or sr
            mono = data.mean(axis=1)
            nz = np.flatnonzero(np.abs(mono) > 10 ** (-65 / 20))
            if not len(nz):
                continue
            seg = mono[nz[0] : min(nz[-1] + int(0.05 * sr), len(mono))]
            marks.append((t, r["name"]))
            chunks.append(seg)
            chunks.append(np.zeros(int(gap * sr)))
            t += len(seg) / sr + gap
        if chunks and sr0:
            wide = max(11.0, min(24.0, t * 0.9))
            spectrogram_image(np.concatenate(chunks), sr0, f"sfx family: {fam}", png_dir / "family" / f"{fam}.png", 512, marks, width=wide)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--notes", default=str(ROOT / "docs" / "audio-notes.md"))
    ap.add_argument("--only", default="", help="comma separated names to analyze (default all)")
    ap.add_argument("--no-notes", action="store_true", help="do not touch docs/audio-notes.md")
    ap.add_argument("--no-png", action="store_true")
    ap.add_argument("--rolls", action="store_true", help="only draw piano rolls from out/songs/*.json (run dump.ts first)")
    args = ap.parse_args()

    out = Path(args.out)
    if args.rolls:
        for js in sorted((out / "songs").glob("*.json")):
            song = json.loads(js.read_text())
            piano_roll(song, out / "png" / "rolls" / f"{song['id']}.png")
            print(f"piano roll {song['id']}")
        return 0
    wav_root = out / "wav"
    only = {s for s in args.only.split(",") if s}
    results: list[dict] = []
    for js in sorted(wav_root.glob("*/*.json")):
        meta = json.loads(js.read_text())
        wav = js.with_suffix(".wav")
        if not wav.exists() or (only and meta["name"] not in only):
            continue
        png = out / "png" / meta["group"] / f"{meta['name']}.png"
        r = analyze_file(wav, meta, png)
        for k in ("bars", "loop", "swing", "intensity"):
            if k in meta:
                r[k if k != "loop" else "loop_flag"] = meta[k]
        r["loop_seconds"] = meta.get("loopSeconds")
        r["flags"] = flags_for(r)
        results.append(r)
        print(f"{r['name']:<24} peak {r['peak_db']:6.1f}  " + (f"LUFS-I {r['lufs_i']:6.1f}" if r.get("lufs_i") is not None else f"event {r.get('lufs_event', 0):6.1f}") + (f"  {' '.join(r['flags'])}" if r["flags"] else ""))

    # merge into what is already there, so analysing one file never forgets the others
    store = out / "analysis.json"
    merged: dict[tuple[str, str], dict] = {}
    if store.exists():
        for r in json.loads(store.read_text()):
            if (wav_root / str(r["group"]) / f"{r['name']}.wav").exists():
                merged[(r["group"], r["name"])] = r
    for r in results:
        merged[(r["group"], r["name"])] = r
    everything = sorted(merged.values(), key=lambda r: (r["group"], r["name"]))
    store.write_text(json.dumps(everything, indent=2))

    sfx_rows = [r for r in everything if r["group"] == "sfx"]
    music_rows = [r for r in everything if r["group"] == "music" and not r.get("solo")]
    solo_rows = [r for r in everything if r["group"] == "music" and r.get("solo")]
    if not args.no_png and any(r["group"] == "sfx" for r in results):
        family_images(sfx_rows, wav_root / "sfx", out / "png")

    balance = layer_balance(solo_rows)
    if balance:
        (out / "balance.json").write_text(json.dumps(balance, indent=2))

    if not args.no_notes and (sfx_rows or music_rows):
        notes = Path(args.notes)
        text = notes.read_text() if notes.exists() else "# Audio notes\n"
        if music_rows:
            text = replace_block(text, "music", music_table(music_rows))
        if sfx_rows:
            text = replace_block(text, "sfx", sfx_table(sfx_rows))
        if solo_rows:
            text = replace_block(text, "layers", layers_table(balance))
        notes.write_text(text)
        print(f"wrote tables into {notes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
