"""Audio measurements and processing shared by generate.py, tune.py and the spike.

Nothing in here plays audio. Everything is numbers: duration, speech rate, F0,
spectral centroid, loudness, clipping, silence, and the MP3 the game will load.
"""
from __future__ import annotations

import re
import shutil
import subprocess

import numpy as np

FFMPEG = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"

# Loudness target before the per-voice trim, integrated LUFS (BS.1770).
TARGET_LUFS = -19.0
# Brickwall ceiling before MP3 encoding. The codec overshoots by up to ~1.5 dB.
PEAK_CEILING_DB = -2.0

ENV_PER_SEC = 20


# --------------------------------------------------------------------------- framing


def _frames(x: np.ndarray, size: int, hop: int) -> np.ndarray:
    if len(x) < size:
        x = np.pad(x, (0, size - len(x)))
    n = 1 + (len(x) - size) // hop
    idx = np.arange(size)[None, :] + hop * np.arange(n)[:, None]
    return x[idx]


def frame_rms(x: np.ndarray, sr: int, win: float = 0.020, hop: float = 0.010) -> np.ndarray:
    size, step = int(win * sr), int(hop * sr)
    f = _frames(x.astype(np.float64), size, step)
    return np.sqrt(np.mean(f * f, axis=1))


def to_db(v, floor: float = 1e-9):
    return 20.0 * np.log10(np.maximum(v, floor))


# --------------------------------------------------------------------------- silence


def trim_silence(
    x: np.ndarray,
    sr: int,
    lead: float = 0.05,
    tail: float = 0.14,
    rel_db: float = -42.0,
    floor_db: float = -62.0,
) -> np.ndarray:
    """Cut leading and trailing silence, keep a small natural pad, add short fades.

    The gate is adaptive: `rel_db` below the loudest 20 ms frame, never below `floor_db`,
    so whispery voices are not eaten and hiss-free voices are still trimmed hard.
    """
    hop = int(0.010 * sr)
    win = int(0.020 * sr)
    db = to_db(frame_rms(x, sr))
    thr = max(db.max() + rel_db, floor_db)
    active = np.where(db > thr)[0]
    if len(active) == 0:
        return x
    start = max(0, active[0] * hop - int(lead * sr))
    end = min(len(x), active[-1] * hop + win + int(tail * sr))
    y = x[start:end].copy()
    fi = min(int(0.006 * sr), len(y) // 2)
    fo = min(int(0.045 * sr), len(y) // 2)
    if fi:
        y[:fi] *= np.linspace(0.0, 1.0, fi)
    if fo:
        y[-fo:] *= np.linspace(1.0, 0.0, fo)
    return y


def silence_stats(x: np.ndarray, sr: int, rel_db: float = -35.0) -> dict:
    """Leading/trailing silence and the longest internal pause, in seconds."""
    hop = 0.010
    db = to_db(frame_rms(x, sr))
    thr = db.max() + rel_db
    active = db > thr
    idx = np.where(active)[0]
    if len(idx) == 0:
        return {"lead": len(x) / sr, "tail": 0.0, "max_gap": 0.0, "active_frac": 0.0}
    lead = idx[0] * hop
    tail = (len(active) - 1 - idx[-1]) * hop
    gap = 0
    best = 0
    for a in active[idx[0] : idx[-1] + 1]:
        gap = 0 if a else gap + 1
        best = max(best, gap)
    return {
        "lead": round(float(lead), 3),
        "tail": round(float(tail), 3),
        "max_gap": round(float(best * hop), 3),
        "active_frac": round(float(active[idx[0] : idx[-1] + 1].mean()), 3),
    }


# --------------------------------------------------------------------------- loudness


def lufs(x: np.ndarray, sr: int) -> float:
    """Integrated loudness (BS.1770). Short clips are padded and corrected."""
    import pyloudnorm as pyln

    n = len(x)
    block = int(0.4 * sr)
    corr = 0.0
    if n < block + int(0.1 * sr):
        corr = 10.0 * np.log10((block + int(0.1 * sr)) / max(n, 1))
        x = np.pad(x, (0, block + int(0.1 * sr) - n))
    meter = pyln.Meter(sr)
    v = float(meter.integrated_loudness(x.astype(np.float64)))
    if not np.isfinite(v):
        return -70.0
    return v + corr


def peak_db(x: np.ndarray) -> float:
    return float(to_db(np.max(np.abs(x))))


def limit_peaks(y: np.ndarray, sr: int, ceiling_db: float = PEAK_CEILING_DB) -> np.ndarray:
    """Look-ahead brickwall limiter. Only touches samples that would pass the ceiling."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    ceiling = 10 ** (ceiling_db / 20.0)
    a = np.abs(y)
    if a.max() <= ceiling:
        return y
    need = np.minimum(1.0, ceiling / np.maximum(a, 1e-9))
    n = max(2, int(0.004 * sr))
    gr = minimum_filter1d(need, size=2 * n + 1, mode="nearest")
    gr = uniform_filter1d(gr, size=n, mode="nearest")
    return y * gr


def match_loudness(x: np.ndarray, sr: int, trim_db: float = 0.0, target: float = TARGET_LUFS):
    """Scale to TARGET_LUFS + trim_db, limit peaks. Returns (audio, applied_gain_db, final_lufs)."""
    cur = lufs(x, sr)
    gain = (target + trim_db) - cur
    gain = float(np.clip(gain, -30.0, 30.0))
    y = x * (10 ** (gain / 20.0))
    y = limit_peaks(y, sr)
    return y.astype(np.float32), gain, lufs(y, sr)


# --------------------------------------------------------------------------- pitch, timbre


def _pitch_track(snd, floor: float, ceiling: float) -> np.ndarray:
    pitch = snd.to_pitch_ac(
        time_step=0.01,
        pitch_floor=floor,
        pitch_ceiling=ceiling,
        voicing_threshold=0.5,
        octave_cost=0.03,
        octave_jump_cost=0.8,
        voiced_unvoiced_cost=0.2,
    )
    return pitch.selected_array["frequency"]


def f0_stats(x: np.ndarray, sr: int, floor: float = 60.0, ceiling: float = 1100.0) -> dict:
    """Median F0 in Hz, spread as std in semitones and p10-p90 in semitones, voiced fraction.

    Two passes (the usual fix for octave errors): a wide first pass finds the speaker's
    own quartiles, the second pass tracks inside 0.75*q1 .. 1.5*q3.
    """
    import parselmouth

    snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=float(sr))
    f0 = _pitch_track(snd, floor, ceiling)
    voiced = f0[f0 > 0]
    if len(voiced) >= 5:
        q1, q3 = np.percentile(voiced, [25, 75])
        f0 = _pitch_track(snd, max(40.0, 0.75 * q1), min(1400.0, 1.5 * q3))
        voiced = f0[f0 > 0]
    if len(voiced) < 5:
        return {"f0_med": 0.0, "f0_std_st": 0.0, "f0_p10_p90_st": 0.0, "voiced_frac": 0.0}
    med = float(np.median(voiced))
    st = 12.0 * np.log2(voiced / med)
    return {
        "f0_med": round(med, 1),
        "f0_std_st": round(float(np.std(st)), 2),
        "f0_p10_p90_st": round(float(np.percentile(st, 90) - np.percentile(st, 10)), 2),
        "voiced_frac": round(float(len(voiced) / len(f0)), 2),
    }


def spectral_centroid(x: np.ndarray, sr: int) -> float:
    """Mean spectral centroid in Hz over active frames (brightness)."""
    n_fft, hop = 1024, 256
    f = _frames(x.astype(np.float64), n_fft, hop) * np.hanning(n_fft)[None, :]
    mag = np.abs(np.fft.rfft(f, axis=1))
    rms = np.sqrt(np.mean(f * f, axis=1))
    keep = to_db(rms) > (to_db(rms).max() - 30.0)
    if not keep.any():
        return 0.0
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    cent = (mag[keep] * freqs[None, :]).sum(axis=1) / np.maximum(mag[keep].sum(axis=1), 1e-9)
    return round(float(cent.mean()), 0)


def clip_ratio(x: np.ndarray, level: float = 0.995) -> float:
    return float(np.mean(np.abs(x) >= level))


# --------------------------------------------------------------------------- text-side rate

_VOWEL_GROUP = re.compile(r"[aeiouy]+", re.I)


def syllables(text: str) -> int:
    n = 0
    for w in re.findall(r"[A-Za-z']+", text):
        n += max(1, len(_VOWEL_GROUP.findall(w)))
    return n


def speech_rate(text: str, dur: float, active_frac: float = 1.0) -> dict:
    words = len(text.split())
    d = max(dur, 1e-3)
    return {"wps": round(words / d, 2), "sps": round(syllables(text) / d, 2)}


# --------------------------------------------------------------------------- envelope


def envelope_hex(x: np.ndarray, sr: int, per_sec: int = ENV_PER_SEC, gamma: float = 0.7) -> str:
    """Loudness envelope for the game: one hex digit per 1/per_sec s, 0 silent, f loudest.

    Smoothed RMS, mapped with a gamma curve so syllable peaks and dips stay visible.
    """
    n = max(1, int(round(len(x) / sr * per_sec)))
    step = sr / per_sec
    win = int(step * 1.2)
    vals = np.zeros(n)
    xf = x.astype(np.float64)
    for i in range(n):
        c = (i + 0.5) * step
        a = int(max(0, c - win / 2))
        b = int(min(len(xf), c + win / 2))
        seg = xf[a:b]
        vals[i] = np.sqrt(np.mean(seg * seg)) if len(seg) else 0.0
    peak = vals.max()
    if peak <= 0:
        return "0" * n
    norm = vals / peak
    norm[to_db(norm) < -48.0] = 0.0
    digits = np.rint(15.0 * np.power(norm, gamma)).astype(int)
    return "".join("0123456789abcdef"[int(np.clip(d, 0, 15))] for d in digits)


# --------------------------------------------------------------------------- mp3 io


def encode_mp3(x: np.ndarray, sr: int, path, kbps: int = 32) -> None:
    """Mono MP3 via libmp3lame, CBR, deterministic (bitexact, no tags)."""
    cmd = [
        FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-",
        "-c:a", "libmp3lame", "-b:a", f"{kbps}k", "-ac", "1",
        "-fflags", "+bitexact", "-flags:a", "+bitexact",
        "-write_xing", "1", "-id3v2_version", "0", "-map_metadata", "-1",
        str(path),
    ]
    subprocess.run(cmd, input=np.ascontiguousarray(x, dtype="<f4").tobytes(), check=True)


def decode_audio(path, sr: int = 24000) -> np.ndarray:
    """Decode any audio file to mono float32 at `sr` with ffmpeg."""
    cmd = [
        FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error",
        "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-",
    ]
    out = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype="<f4").astype(np.float32)


# --------------------------------------------------------------------------- one-call report


def measure(x: np.ndarray, sr: int, text: str = "") -> dict:
    """All the numbers we judge a clip by."""
    dur = len(x) / sr
    sil = silence_stats(x, sr)
    out = {
        "dur": round(dur, 2),
        "rms_db": round(float(to_db(np.sqrt(np.mean(x.astype(np.float64) ** 2)))), 1),
        "peak_db": round(peak_db(x), 1),
        "lufs": round(lufs(x, sr), 1),
        "clip": round(clip_ratio(x), 5),
        "centroid": spectral_centroid(x, sr),
        **f0_stats(x, sr),
        **{f"sil_{k}": v for k, v in sil.items()},
    }
    if text:
        out.update(speech_rate(text, max(dur - sil["lead"] - sil["tail"], 0.1)))
    return out
