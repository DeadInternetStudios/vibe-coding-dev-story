#!/usr/bin/env python3
"""Spike: can Qwen3-TTS-12Hz-1.7B-VoiceDesign run here, how fast, and does a voice stay one voice?

Writes wavs and spike_report.json under tools/tts/scratch/spike/ (git ignored). Never plays audio.

  .venv/bin/python spike.py            # everything
  .venv/bin/python spike.py --stage design|clone|report

Stages
  design  6 voices x (1 own line + 5 shared lines) through VoiceDesign, default sampling.
  clone   per voice: pick the best take as the reference, render the same 5 shared lines
          through the Base 1.7B clone path (ICL, cached reference), same metrics.
  report  consistency numbers (F0 median / spread / centroid / speaker embedding) per route.
"""
from __future__ import annotations

import argparse
import json
import resource
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib import audio, stt  # noqa: E402

OUT = HERE / "scratch" / "spike"
WAV = OUT / "wav"
REPORT = OUT / "spike_report.json"

VD_REPO = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"
BASE_REPO = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"

VOICES = {
    "dave": "A tired American man in his mid fifties. Low, gravelly voice with a rough smoky texture, very slow pace, "
            "flat dry deadpan delivery, long weary sighs between phrases, almost no pitch variation, unimpressed. Quiet room.",
    "jenny": "A young American woman in her early twenties. Anxious and breathy, high pitched, fast pace, "
             "up-talking rising intonation at the end of phrases, panicking politely, voice trembling with nervous energy. Close microphone.",
    "narrator": "An elderly British man with a soft, hushed, warm voice. Slow measured pace, wise and gently amused, "
                "whispering like a nature documentary presenter hiding in the bushes. Refined southern English accent.",
    "announcer": "A huge, bombastic American male announcer. Deep booming chest voice, thrilled and theatrical, big dynamic swings, "
                 "a little hoarse from shouting, awards show delivery with long held vowels. Dry studio recording.",
    "duck": "A tiny, squeaky cartoon rubber duck. Extremely high pitched, nasal, comical, deadly serious about being a duck, "
            "with a strong quacking quality.",
    "automod": "A flat, metallic, emotionless robot voice. Monotone, perfectly even pace, no pitch variation, neutral gender, "
               "cold and clipped, like a machine reading terms of service.",
}

OWN_LINE = {
    "dave": "Did anyone actually read the diff?",
    "jenny": "I pressed Accept All and now the screen is on fire. Is that normal?",
    "narrator": "And here, in the glow of the monitor, we observe the vibe coder in its natural habitat.",
    "announcer": "Ladies and gentlemen! Developers of all ages! Welcome to the Vibey Awards!",
    "duck": "Quack quack? Quack.",
    "automod": "Your submission has been removed. Reason: low effort. Also, vibes.",
}

SHARED = [
    "Did anyone actually read the diff?",
    "I've been writing code for thirty years and I have never been this tired.",
    "Your app deleted my to-do list, and it was very important.",
    "We're pre-revenue, but we are post-vibes. That's the hard part.",
    "This function is four thousand lines long. It's called doStuff.",
]

ANCHOR = "Honestly, I think we should just ship it and see what happens."


def max_tokens_for(text: str) -> int:
    return int(min(1500, 60 + 16 * len(text.split())))


def rss_gb() -> float:
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9  # bytes on macOS


class Rig:
    def __init__(self, need_base: bool):
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model

        self.mx = mx
        t = time.time()
        self.vd = load_model(VD_REPO)
        self.load_vd = time.time() - t
        self.base = None
        if need_base:
            t = time.time()
            self.base = load_model(BASE_REPO)
            self.load_base = time.time() - t
        self.sr = self.vd.sample_rate
        self.stt = stt.Stt()
        self.rows = []

    def _finish(self, route, voice, text, seed, wav, compute, tokens, peak_gb, tag):
        sr = self.sr
        dur = len(wav) / sr
        path = WAV / f"{route}_{voice}_{tag}_s{seed}.wav"
        sf.write(path, wav, sr)
        m = audio.measure(wav, sr, text)
        tr = self.stt.transcribe(path)
        sc = stt.score(text, tr.text)
        row = {
            "route": route, "voice": voice, "tag": tag, "seed": seed, "text": text,
            "compute_s": round(compute, 2), "audio_s": round(dur, 2),
            "rtf": round(compute / max(dur, 1e-6), 3), "tokens": tokens,
            "mlx_peak_gb": round(peak_gb, 2), "wer": sc.wer, "missing": sc.missing, "extra": sc.extra,
            "heard": tr.text, "file": path.name, **m,
        }
        self.rows.append(row)
        return row

    def design(self, voice, desc, text, seed, tag):
        mx = self.mx
        mx.random.seed(seed)
        t = time.time()
        res = list(self.vd.generate_voice_design(text=text, instruct=desc, language="English", max_tokens=max_tokens_for(text)))
        el = time.time() - t
        if not res:
            return None
        r = res[0]
        wav = np.array(r.audio, dtype=np.float32)
        return self._finish("design", voice, text, seed, wav, el, r.token_count, r.peak_memory_usage, tag), wav

    def clone(self, voice, ref_wav, ref_text, text, seed, tag):
        mx = self.mx
        mx.random.seed(seed)
        t = time.time()
        res = list(self.base.generate(
            text=text, ref_audio=mx.array(ref_wav), ref_text=ref_text, lang_code="english",
            max_tokens=max_tokens_for(text),
        ))
        el = time.time() - t
        if not res:
            return None
        r = res[0]
        wav = np.array(r.audio, dtype=np.float32)
        return self._finish("clone", voice, text, seed, wav, el, r.token_count, r.peak_memory_usage, tag), wav

    def embed(self, wav):
        e = self.base.extract_speaker_embedding(self.mx.array(wav))
        e = np.array(e, dtype=np.float32).reshape(-1)
        return e / (np.linalg.norm(e) + 1e-9)


def stage_design(rig: Rig, state: dict):
    print("== design: own lines", flush=True)
    for voice, desc in VOICES.items():
        out = rig.design(voice, desc, OWN_LINE[voice], seed=1, tag="own")
        if out:
            r, _ = out
            print(f"  {voice:9s} dur={r['audio_s']:5.2f}s rtf={r['rtf']:.2f} wer={r['wer']:.2f} f0={r['f0_med']:6.1f}Hz "
                  f"std={r['f0_std_st']:.1f}st cent={r['centroid']:.0f} wps={r['wps']} | {r['heard']!r}", flush=True)
    print("== design: shared lines", flush=True)
    for voice, desc in VOICES.items():
        for i, text in enumerate(SHARED):
            out = rig.design(voice, desc, text, seed=100 + i, tag=f"shared{i}")
            if out:
                r, _ = out
                print(f"  {voice:9s} L{i} dur={r['audio_s']:5.2f}s rtf={r['rtf']:.2f} wer={r['wer']:.2f} "
                      f"f0={r['f0_med']:6.1f} cent={r['centroid']:.0f}", flush=True)
    print("== design: anchors (3 takes per voice, candidates for the clone reference)", flush=True)
    for voice, desc in VOICES.items():
        for k in range(3):
            out = rig.design(voice, desc, ANCHOR, seed=500 + k, tag=f"anchor{k}")
            if out:
                r, _ = out
                print(f"  {voice:9s} A{k} dur={r['audio_s']:5.2f}s wer={r['wer']:.2f} f0={r['f0_med']:6.1f} cent={r['centroid']:.0f}", flush=True)


def pick_reference(rows: list, voice: str):
    """Best anchor take: no recognition errors, F0 closest to the voice's typical F0."""
    cands = [r for r in rows if r["route"] == "design" and r["voice"] == voice and r["tag"].startswith("anchor")]
    typical = statistics.median(r["f0_med"] for r in rows if r["route"] == "design" and r["voice"] == voice)
    cands = [r for r in cands if r["wer"] <= 0.0] or cands
    return min(cands, key=lambda r: abs(np.log2(max(r["f0_med"], 1) / typical)))


def stage_clone(rig: Rig, state: dict):
    print("== clone: reference picks", flush=True)
    for voice in VOICES:
        ref = pick_reference(rig.rows, voice)
        ref_wav, _ = sf.read(WAV / ref["file"], dtype="float32")
        state.setdefault("refs", {})[voice] = ref["file"]
        print(f"  {voice:9s} ref={ref['file']} f0={ref['f0_med']} dur={ref['audio_s']}s", flush=True)
        for i, text in enumerate(SHARED):
            out = rig.clone(voice, ref_wav, ANCHOR, text, seed=100 + i, tag=f"shared{i}")
            if out:
                r, _ = out
                print(f"  {voice:9s} L{i} dur={r['audio_s']:5.2f}s rtf={r['rtf']:.2f} wer={r['wer']:.2f} "
                      f"f0={r['f0_med']:6.1f} cent={r['centroid']:.0f} | {r['heard'][:50]!r}", flush=True)
        out = rig.clone(voice, ref_wav, ANCHOR, OWN_LINE[voice], seed=1, tag="own")
        if out:
            r, _ = out
            print(f"  {voice:9s} own dur={r['audio_s']:5.2f}s rtf={r['rtf']:.2f} wer={r['wer']:.2f} f0={r['f0_med']:6.1f}", flush=True)


def cv(vals):
    vals = [v for v in vals if v]
    if len(vals) < 2:
        return 0.0
    return statistics.pstdev(vals) / statistics.mean(vals)


def st_range(vals):
    vals = [v for v in vals if v]
    return 12 * np.log2(max(vals) / min(vals)) if len(vals) > 1 else 0.0


def stage_report(rig: Rig | None, state: dict):
    rows = state["rows"]
    # speaker embeddings for every shared clip (from the Base model's speaker encoder)
    if rig is not None and rig.base is not None:
        for r in rows:
            if r["tag"].startswith("shared") or r["tag"] == "own":
                wav, _ = sf.read(WAV / r["file"], dtype="float32")
                r["_emb"] = rig.embed(wav).tolist()
    rep = {}
    for route in ("design", "clone"):
        per_voice = {}
        for voice in VOICES:
            rs = [r for r in rows if r["route"] == route and r["voice"] == voice and r["tag"].startswith("shared")]
            if not rs:
                continue
            embs = [np.array(r["_emb"]) for r in rs if "_emb" in r]
            sims = [float(embs[i] @ embs[j]) for i in range(len(embs)) for j in range(i + 1, len(embs))]
            per_voice[voice] = {
                "n": len(rs),
                "f0_med_mean": round(statistics.mean(r["f0_med"] for r in rs), 1),
                "f0_med_cv_pct": round(100 * cv([r["f0_med"] for r in rs]), 1),
                "f0_med_range_st": round(float(st_range([r["f0_med"] for r in rs])), 2),
                "f0_std_st_mean": round(statistics.mean(r["f0_std_st"] for r in rs), 2),
                "f0_std_st_cv_pct": round(100 * cv([r["f0_std_st"] for r in rs]), 1),
                "centroid_mean": round(statistics.mean(r["centroid"] for r in rs)),
                "centroid_cv_pct": round(100 * cv([r["centroid"] for r in rs]), 1),
                "wps_mean": round(statistics.mean(r["wps"] for r in rs), 2),
                "spk_cos_mean": round(statistics.mean(sims), 3) if sims else None,
                "spk_cos_min": round(min(sims), 3) if sims else None,
                "wer_mean": round(statistics.mean(r["wer"] for r in rs), 3),
                "rtf_median": round(statistics.median(r["rtf"] for r in rs), 2),
            }
        rep[route] = per_voice

    # between-voice speaker similarity for context (design route)
    between = []
    for route in ("design", "clone"):
        by_voice = {}
        for r in rows:
            if r["route"] == route and r["tag"].startswith("shared") and "_emb" in r:
                by_voice.setdefault(r["voice"], []).append(np.array(r["_emb"]))
        vs = list(by_voice)
        sims = []
        for a in range(len(vs)):
            for b in range(a + 1, len(vs)):
                for ea in by_voice[vs[a]]:
                    for eb in by_voice[vs[b]]:
                        sims.append(float(ea @ eb))
        between.append((route, round(statistics.mean(sims), 3) if sims else None))
    rep["between_voice_spk_cos"] = dict(between)

    for route in ("design", "clone"):
        pv = rep.get(route, {})
        if not pv:
            continue
        print(f"\n== consistency: {route}")
        print(f"{'voice':10s} {'F0 med':>7s} {'CV%':>5s} {'rng st':>6s} {'F0sd st':>7s} {'cent':>6s} {'CV%':>5s} {'wps':>5s} {'spk cos':>8s} {'min':>6s} {'WER':>5s} {'RTF':>5s}")
        for v, d in pv.items():
            print(f"{v:10s} {d['f0_med_mean']:7.1f} {d['f0_med_cv_pct']:5.1f} {d['f0_med_range_st']:6.2f} {d['f0_std_st_mean']:7.2f} "
                  f"{d['centroid_mean']:6d} {d['centroid_cv_pct']:5.1f} {d['wps_mean']:5.2f} {d['spk_cos_mean']!s:>8s} {d['spk_cos_min']!s:>6s} {d['wer_mean']:5.2f} {d['rtf_median']:5.2f}")
        keys = ["f0_med_cv_pct", "f0_med_range_st", "centroid_cv_pct", "spk_cos_mean", "spk_cos_min"]
        print("  mean over voices: " + ", ".join(f"{k}={statistics.mean(d[k] for d in pv.values() if d[k] is not None):.3f}" for k in keys))
    print("\nbetween-voice speaker cosine (lower = easier to tell voices apart):", rep["between_voice_spk_cos"])
    state["report"] = rep
    for r in rows:
        r.pop("_emb", None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", default="all", choices=["all", "design", "clone", "report"])
    args = ap.parse_args()
    WAV.mkdir(parents=True, exist_ok=True)

    state = json.loads(REPORT.read_text()) if REPORT.exists() and args.stage in ("clone", "report") else {"rows": []}
    need_base = args.stage in ("all", "clone", "report")
    rig = Rig(need_base=need_base)
    rig.rows = state["rows"]
    print(f"loaded VoiceDesign in {rig.load_vd:.1f}s; mlx active {rig.mx.get_active_memory()/1e9:.2f} GB; rss {rss_gb():.2f} GB", flush=True)

    t0 = time.time()
    if args.stage in ("all", "design"):
        stage_design(rig, state)
    if args.stage in ("all", "clone"):
        stage_clone(rig, state)
    if args.stage in ("all", "report"):
        stage_report(rig, state)
    state["rows"] = rig.rows
    state["env"] = {
        "mlx_peak_gb": round(rig.mx.get_peak_memory() / 1e9, 2),
        "process_max_rss_gb": round(rss_gb(), 2),
        "load_vd_s": round(rig.load_vd, 1),
        "wall_s": round(time.time() - t0, 1),
    }
    REPORT.write_text(json.dumps(state, indent=1))
    print(f"\nwrote {REPORT}  (peak mlx {state['env']['mlx_peak_gb']} GB, max rss {state['env']['process_max_rss_gb']} GB)")


if __name__ == "__main__":
    main()
