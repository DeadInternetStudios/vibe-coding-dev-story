#!/usr/bin/env python3
"""Turn tune.py runs into intent bands, and show where every voice sits in the cast.

    .venv/bin/python calibrate.py scratch/tune/final.json              # table and proposed bands, writes nothing
    .venv/bin/python calibrate.py scratch/tune/final.json --write      # store the bands in voices.json

For each voice it takes the usable probe takes (WER at most 0.10, not capped, enough voiced audio), and
centres the pitch band on their median pitch (+/- --st semitones) and the pace band on their median
words per second (+/- --rate-pct percent). generate.py then keeps takes inside the band and prefers the
ones near its middle. An `f0_std_st` band exists only for voices meant to be flat (monotone robot, doomer):
if the voice has one, its upper edge is set to 1.2 x the median pitch spread of the probe takes.

The cast map sorts voices by median pitch and prints the gap to the next voice, so near-twins show up.
Voices that are close in pitch must differ in texture, pace or delivery instead.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent


def usable(row: dict) -> bool:
    return (row["wer"] <= 0.10 and not row.get("capped") and row["f0_med"] > 0
            and row["dur"] * row["voiced_frac"] >= 0.5)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("runs", nargs="+", help="tune.py result files (scratch/tune/<tag>.json)")
    ap.add_argument("--voices", default=str(HERE / "voices.json"))
    ap.add_argument("--voice", action="append", help="only these voices")
    ap.add_argument("--variant", default=None, help="only rows of this variant label")
    ap.add_argument("--st", type=float, default=3.0, help="pitch band half width in semitones")
    ap.add_argument("--rate-pct", type=float, default=30.0, help="pace band half width in percent")
    ap.add_argument("--min-n", type=int, default=4)
    ap.add_argument("--write", action="store_true", help="write the proposed f0 and wps bands into voices.json")
    args = ap.parse_args()

    rows_by_voice: dict[str, list] = {}
    for path in args.runs:
        for blk in json.load(open(path)):
            for r in blk["rows"]:
                if args.variant and r["variant"] != args.variant:
                    continue
                if args.voice and r["voice"] not in args.voice:
                    continue
                if usable(r):
                    rows_by_voice.setdefault(r["voice"], []).append(r)

    voices = json.load(open(args.voices))
    stats = {}
    print("%-10s %3s %8s %14s %6s   %-14s %-12s | %s" % ("voice", "n", "F0 med", "p10-p90 Hz", "wps", "f0 band", "wps band", "old bands"))
    for vid, rows in rows_by_voice.items():
        if vid not in voices or len(rows) < args.min_n:
            print("%-10s %3d  (skipped: %s)" % (vid, len(rows), "not in voices.json" if vid not in voices else "too few usable takes"))
            continue
        f0s = sorted(r["f0_med"] for r in rows)
        m = statistics.median(f0s)
        p10, p90 = f0s[int(0.1 * (len(f0s) - 1))], f0s[int(round(0.9 * (len(f0s) - 1)))]
        rates = [r["wps"] for r in rows if len(r["text"].split()) >= 4 and r["wps"] > 0]
        w = statistics.median(rates) if rates else None
        f0_band = [round(m * 2 ** (-args.st / 12)), round(m * 2 ** (args.st / 12))]
        wps_band = [round(w * (1 - args.rate_pct / 100), 2), round(w * (1 + args.rate_pct / 100), 2)] if w else None
        old = voices[vid].get("target", {})
        stats[vid] = (m, f0_band, wps_band)
        print("%-10s %3d %7.0f  %6.0f-%-6.0f %6.2f   %-14s %-12s | %s %s" % (
            vid, len(rows), m, p10, p90, w or 0, f0_band, wps_band, old.get("f0"), old.get("wps")))
        if args.write:
            tgt = dict(old)
            tgt["f0"] = f0_band
            if wps_band:
                tgt["wps"] = wps_band
            if "f0_std_st" in old:
                spread = statistics.median(r["f0_std_st"] for r in rows)
                tgt["f0_std_st"] = [0, round(max(2.0, 1.2 * spread), 1)]
            voices[vid]["target"] = tgt

    print("\ncast map, lowest to highest median pitch (gap = semitones to the next voice):")
    ordered = sorted(stats.items(), key=lambda kv: kv[1][0])
    for i, (vid, (m, _, _)) in enumerate(ordered):
        gap = 12 * math.log2(ordered[i + 1][1][0] / m) if i + 1 < len(ordered) else None
        twin = "  <- close to the next voice" if gap is not None and gap < 1.0 else ""
        print("  %-10s %6.0f Hz  %s%s" % (vid, m, "" if gap is None else "+%.1f st" % gap, twin))

    if args.write:
        with open(args.voices, "w", encoding="utf-8") as fh:
            json.dump(voices, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        print("\nwrote bands for %d voices to %s" % (len(stats), args.voices))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
