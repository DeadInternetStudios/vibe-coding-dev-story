#!/usr/bin/env python3
"""Tune a voice description against numbers. Never plays audio.

Renders probe lines for one or more voices (optionally under several sampling variants),
measures every take (F0 median and spread, spectral centroid, speech rate, loudness, WER via
speech to text) and prints how consistent the voice is from line to line, and whether it meets
the intent band written in voices.json (`target`).

    .venv/bin/python tune.py --voice dave --voice announcer
    .venv/bin/python tune.py --voice dave --variant "cold:temperature=0.6,top_k=30"
    .venv/bin/python tune.py --voice dave --variant "cold:temperature=0.6" --variant "same:temperature=0.6,seed=same"
    .venv/bin/python tune.py --voices-file scratch/voices_v2.json --voice dave --lines own

Variant keys: temperature, top_k, top_p, repetition_penalty, seed=same|varied (default varied).
Wavs and a json of every number land in scratch/tune/ (git ignored).
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib import audio, stt, tts  # noqa: E402

SHARED = [
    "Did anyone actually read the diff?",
    "I've been writing code for thirty years and I have never been this tired.",
    "Your app deleted my to-do list, and it was very important.",
    "We're pre-revenue, but we are post-vibes. That's the hard part.",
    "This function is four thousand lines long. It's called doStuff.",
]
OUT = HERE / "scratch" / "tune"


def parse_variant(spec: str):
    name, _, rest = spec.partition(":")
    opts = {}
    for kv in filter(None, rest.split(",")):
        k, _, v = kv.partition("=")
        opts[k.strip()] = v.strip()
    sampling = {}
    for k in ("temperature", "top_p", "repetition_penalty"):
        if k in opts:
            sampling[k] = float(opts[k])
    if "top_k" in opts:
        sampling["top_k"] = int(opts["top_k"])
    return name or "base", sampling, opts.get("seed", "varied")


def own_lines(voice: str, n: int = 5):
    p = HERE / "lines.seed.json"
    rows = [r for r in json.loads(p.read_text())["lines"] if r["voice"] == voice]
    # prefer a spread of lengths: sort by length and take evenly
    rows.sort(key=lambda r: len(r["text"]))
    if len(rows) <= n:
        return [(r["text"], r.get("delivery")) for r in rows]
    idx = np.linspace(0, len(rows) - 1, n).round().astype(int)
    return [(rows[i]["text"], rows[i].get("delivery")) for i in idx]


def cv(vals):
    vals = [v for v in vals if v]
    return statistics.pstdev(vals) / statistics.mean(vals) if len(vals) > 1 else 0.0


def st_range(vals):
    vals = [v for v in vals if v]
    return float(12 * np.log2(max(vals) / min(vals))) if len(vals) > 1 else 0.0


def verdict(summary: dict, target: dict | None):
    if not target:
        return "no target"
    notes = []
    lo, hi = target["f0"]
    notes.append(("f0 ok" if lo <= summary["f0_med"] <= hi else f"F0 {summary['f0_med']:.0f} outside {lo}-{hi}"))
    lo, hi = target["wps"]
    notes.append(("rate ok" if lo <= summary["wps"] <= hi else f"RATE {summary['wps']:.2f} outside {lo}-{hi}"))
    if "f0_std_st" in target:
        lo, hi = target["f0_std_st"]
        notes.append(("spread ok" if lo <= summary["f0_std_st"] <= hi else f"SPREAD {summary['f0_std_st']:.1f} outside {lo}-{hi}"))
    bad = [n for n in notes if n.isupper() or n.startswith(("F0", "RATE", "SPREAD"))]
    return ("PASS " if not bad else "FAIL ") + "; ".join(notes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices-file", default=str(HERE / "voices.json"))
    ap.add_argument("--voice", action="append", required=True)
    ap.add_argument("--lines", default="shared", help="shared | own | N (first N shared)")
    ap.add_argument("--variant", action="append", default=[])
    ap.add_argument("--delivery", default=None, help="delivery note applied to every probe line")
    ap.add_argument("--desc", default=None, help="override the description (single voice)")
    ap.add_argument("--tag", default=None)
    ap.add_argument("--seed0", type=int, default=100)
    ap.add_argument("--quiet", action="store_true", help="summary only")
    args = ap.parse_args()

    voices = json.loads(Path(args.voices_file).read_text())
    variants = [parse_variant(v) for v in (args.variant or ["base"])]
    tag = args.tag or time.strftime("%H%M%S")
    wavdir = OUT / tag
    wavdir.mkdir(parents=True, exist_ok=True)

    eng = tts.Engine()
    st_model = stt.Stt()
    print(f"engine loaded in {eng.load_s:.1f}s", flush=True)

    results = []
    for vid in args.voice:
        v = voices[vid]
        desc = args.desc or v["description"]
        if args.lines == "own":
            probe = own_lines(vid)
        elif args.lines == "shared":
            probe = [(t, None) for t in SHARED]
        else:
            probe = [(t, None) for t in SHARED[: int(args.lines)]]
        for vname, sampling, seedmode in variants:
            rows = []
            for i, (text, delivery) in enumerate(probe):
                delivery = args.delivery or delivery
                seed = args.seed0 if seedmode == "same" else args.seed0 + i
                take = eng.design(tts.compose_instruct(desc, delivery), text, seed, **sampling)
                if take is None:
                    print(f"  {vid} {vname} L{i}: no audio", flush=True)
                    continue
                x = audio.trim_silence(take.wav, take.sr)
                path = wavdir / f"{vid}_{vname}_L{i}.wav"
                sf.write(path, x, take.sr)
                m = audio.measure(x, take.sr, text)
                tr = st_model.transcribe(path)
                sc = stt.score(text, tr.text)
                row = {"voice": vid, "variant": vname, "line": i, "text": text, "delivery": delivery, "seed": seed,
                       "rtf": round(take.rtf, 2), "tokens": take.tokens, "capped": take.hit_cap, "wer": sc.wer,
                       "heard": tr.text, **m}
                rows.append(row)
                if not args.quiet:
                    flag = " CAPPED" if take.hit_cap else ""
                    print(f"  {vid:9s} {vname:8s} L{i} {m['dur']:5.2f}s rtf={take.rtf:4.2f} wer={sc.wer:.2f} f0={m['f0_med']:6.1f} sd={m['f0_std_st']:4.1f}st "
                          f"cent={m['centroid']:5.0f} wps={m['wps']:4.2f} lufs={m['lufs']:6.1f} pk={m['peak_db']:5.1f} gap={m['sil_max_gap']:.2f}{flag}", flush=True)
                    if sc.wer > 0:
                        print(f"        heard: {tr.text!r}", flush=True)
            if not rows:
                continue
            summ = {
                "f0_med": statistics.mean(r["f0_med"] for r in rows),
                "f0_cv_pct": 100 * cv([r["f0_med"] for r in rows]),
                "f0_rng_st": st_range([r["f0_med"] for r in rows]),
                "f0_std_st": statistics.mean(r["f0_std_st"] for r in rows),
                "centroid": statistics.mean(r["centroid"] for r in rows),
                "cent_cv_pct": 100 * cv([r["centroid"] for r in rows]),
                "wps": statistics.mean(r["wps"] for r in rows),
                "wer": statistics.mean(r["wer"] for r in rows),
                "rtf": statistics.median(r["rtf"] for r in rows),
            }
            print(f"== {vid:9s} {vname:8s} n={len(rows)} F0 {summ['f0_med']:6.1f}Hz  CV {summ['f0_cv_pct']:4.1f}%  range {summ['f0_rng_st']:4.1f}st  "
                  f"spread {summ['f0_std_st']:3.1f}st  centroid {summ['centroid']:5.0f} CV {summ['cent_cv_pct']:4.1f}%  wps {summ['wps']:4.2f}  "
                  f"WER {summ['wer']:.2f}  RTF {summ['rtf']:.2f}", flush=True)
            print(f"   {verdict(summ, v.get('target'))}", flush=True)
            results.append({"voice": vid, "variant": vname, "summary": summ, "rows": rows})

    (OUT / f"{tag}.json").write_text(json.dumps(results, indent=1))
    print(f"\nsaved {OUT / (tag + '.json')}  wavs in {wavdir}")


if __name__ == "__main__":
    main()
