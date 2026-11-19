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
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FFMPEG = "/opt/homebrew/bin/ffmpeg"

CEILING_DBFS = 20 * math.log10(0.708)  # the engine's hard limiter ceiling, about -3.0
MUSIC_TARGET_LUFS = -18.0
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


def detect_key(mono: np.ndarray, sr: int) -> dict:
    nfft, hop = 8192, 4096
    if len(mono) < nfft:
        mono = np.pad(mono, (0, nfft - len(mono)))
    f, _t, mag = stft_power(mono, sr, nfft, hop)
    sel = (f >= 65) & (f <= 2100)
    freqs = f[sel]
    pc = (np.round(12 * np.log2(freqs / 440.0) + 69).astype(int)) % 12
    power = (mag[sel] ** 2).sum(axis=1)
    chroma = np.zeros(12)
    np.add.at(chroma, pc, power)
    if chroma.sum() <= 0:
        return {"key": None, "score": 0.0, "top3": []}
    chroma = chroma / chroma.sum()
    scores = []
    for tonic in range(12):
        for mode, prof in (("major", KS_MAJOR), ("minor", KS_MINOR)):
            r = np.corrcoef(chroma, np.roll(prof, tonic))[0, 1]
            scores.append((float(r), f"{NOTE_NAMES[tonic]} {mode}"))
    scores.sort(reverse=True)
    return {"key": scores[0][1], "score": scores[0][0], "top3": [s[1] for s in scores[:3]]}


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
        i = int(round(t * sr))
        a, b = rms(mono[max(i - h, 0) : i]), rms(mono[i : i + h])
        return db(b) - db(a) if a > 1e-6 and b > 1e-6 else 0.0

    total = len(mono) / sr
    bars = []
    j = 1
    while start + j * bar + 0.1 < total and j < 400:
        t = start + j * bar
        if all(abs(t - s) > 0.01 for s in seams):
            bars.append(t)
        j += 1
    bar_steps = [step(t) for t in bars] or [1e-9]
    bar_jumps = [jump_db(t) for t in bars] or [0.0]
    seam_steps = [step(t) for t in seams]
    seam_jumps = [jump_db(t) for t in seams]

    out = {
        "seam_click_ratio": max(seam_steps) / max(float(np.median(bar_steps)), 1e-9),
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
    if len(seams) >= 3:
        a, b, c = (int(round(s * sr)) for s in seams[:3])
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
        res["key_score"] = key["score"]
        seam = loop_seam(mono, sr, meta)
        if seam:
            res.update(seam)
        res["lufs_target"] = MUSIC_TARGET_LUFS
        # music loudness is judged after the loop has settled: measure the middle loop alone
        loop = float(meta.get("loopSeconds") or 0)
        if loop > 0 and meta.get("loop") and len(mono) / sr > loop * 2.2:
            a = int((0.06 + loop) * sr)
            b = int((0.06 + 2 * loop) * sr)
            res["lufs_loop"] = event_lufs(data[a:b], sr)[0]
            res["peak_loop_db"] = db(np.abs(data[a:b]).max())
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
    fl: list[str] = []
    if not r["finite"]:
        fl.append("NaN")
    if r["clip_count"] > 0:
        fl.append("CLIP")
    if r["peak_db"] > CEILING_DBFS + 0.15:
        fl.append("PEAK>-3")
    if r["dc"] > 0.002:
        fl.append("DC")
    if r["group"] == "music":
        li = r.get("lufs_loop")
        if li is not None and abs(li - MUSIC_TARGET_LUFS) > 2.0 and "@" not in r["name"]:
            fl.append(f"LUFS {li - MUSIC_TARGET_LUFS:+.1f}")
        if r.get("tempo_match") == "MISMATCH":
            fl.append("TEMPO")
        if r.get("key_match") in ("MISMATCH",):
            fl.append("KEY")
        if r.get("seam_click_ratio", 0) > 2.5:
            fl.append("SEAM")
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
    head = "| Song | BPM set/found | Key set/found | Bars | Loop s | LUFS-I | LUFS loop | Peak dBFS | TP dBTP | Centroid Hz | Roll-off 95% | Seam click x | Seam dB | Loop corr | Flags |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n"
    lines = []
    for r in rows:
        lines.append(
            "| {n} | {bs}/{bf} {bm} | {ks}/{kf} {km} | {bars} | {loop} | {li} | {ll} | {pk} | {tp} | {ce} | {ro} | {sc} | {sd} | {lc} | {fl} |".format(
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
    args = ap.parse_args()

    out = Path(args.out)
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
        print(f"{r['name']:<18} peak {r['peak_db']:6.1f}  " + (f"LUFS-I {r['lufs_i']:6.1f}" if r.get("lufs_i") is not None else f"event {r.get('lufs_event', 0):6.1f}") + (f"  {' '.join(r['flags'])}" if r["flags"] else ""))

    (out / "analysis.json").write_text(json.dumps(results, indent=2))
    sfx_rows = [r for r in results if r["group"] == "sfx"]
    music_rows = [r for r in results if r["group"] == "music"]
    if not args.no_png and sfx_rows:
        family_images(sfx_rows, wav_root / "sfx", out / "png")

    if not args.no_notes and (sfx_rows or music_rows) and not only:
        notes = Path(args.notes)
        text = notes.read_text() if notes.exists() else "# Audio notes\n"
        if music_rows:
            text = replace_block(text, "music", music_table(music_rows))
        if sfx_rows:
            text = replace_block(text, "sfx", sfx_table(sfx_rows))
        notes.write_text(text)
        print(f"wrote tables into {notes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
