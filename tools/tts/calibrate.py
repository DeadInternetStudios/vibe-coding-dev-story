#!/usr/bin/env python3
"""Turn measured takes into intent bands, and show where every voice sits in the cast.

Two sources of takes:

    .venv/bin/python calibrate.py scratch/tune/final_100.json scratch/tune/final_200.json --variant final
        probe takes from tune.py (a few neutral shared sentences per voice)
    .venv/bin/python calibrate.py --log generate.log
        the first take generate.py made for each of the voice's own lines (what it really has to say, hype and all)

Add --write to store the bands in voices.json; without it nothing is written.

For each voice it takes the usable takes (WER at most 0.10, not capped) and centres the pitch band on their
median pitch (+/- --st semitones) and the pace band on their median words per second (+/- --rate-pct percent).
generate.py then keeps takes inside the band and prefers the ones near its middle. An `f0_std_st` band exists
only for voices meant to be flat (monotone robot, doomer): if the voice has one, and the source has pitch
spread numbers (tune.py runs do), its upper edge becomes 1.2 x the median spread.

The cast map sorts voices by median pitch and prints the gap to the next voice, so near-twins show up.
Voices that are close in pitch must differ in texture, pace or delivery instead.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent

TAKE_RE = re.compile(
    r"INFO (?P<id>[a-z0-9]+)-[0-9a-f]{8} take (?P<k>\d+)/\d+ seed=\d+ dur=(?P<dur>[\d.]+)s wer=(?P<wer>[\d.]+) "
    r"f0=(?P<f0>\d+) wps=(?P<wps>[\d.]+)")


def dump_voices(voices: dict) -> str:
    """voices.json with one field per line and `target` and `sampling` kept on a single line."""
    out = []
    for vid, v in voices.items():
        fields = []
        for k, val in v.items():
            if isinstance(val, dict):
                inner = ", ".join("%s: %s" % (json.dumps(a), json.dumps(b)) for a, b in val.items())
                fields.append("    %s: {%s}" % (json.dumps(k), inner))
            else:
                fields.append("    %s: %s" % (json.dumps(k), json.dumps(val, ensure_ascii=False)))
        out.append("  %s: {\n%s\n  }" % (json.dumps(vid), ",\n".join(fields)))
    return "{\n%s\n}\n" % ",\n".join(out)


def takes_from_runs(paths: list, variant: str | None) -> dict:
    """voice -> [{f0, wps, spread, wer, rate_ok}] from tune.py result files."""
    out: dict = {}
    for path in paths:
        for blk in json.load(open(path)):
            for r in blk["rows"]:
                if variant and r["variant"] != variant:
                    continue
                if r.get("capped") or r["f0_med"] <= 0 or r["dur"] * r["voiced_frac"] < 0.5:
                    continue
                out.setdefault(r["voice"], []).append({
                    "f0": r["f0_med"], "wps": r["wps"], "spread": r["f0_std_st"], "wer": r["wer"],
                    "rate_ok": len(r["text"].split()) >= 4 and r["wps"] > 0})
    return out


def takes_from_log(path: str) -> dict:
    """voice -> [{f0, wps, spread: None, wer, rate_ok}] from the take lines of generate.log.

    Only the first take of each line: it is an unbiased sample of what the model does with that content.
    Later takes exist only because earlier ones were not close enough, so they would skew the median.
    """
    out: dict = {}
    for line in open(path, encoding="utf-8", errors="replace"):
        m = TAKE_RE.search(line)
        if not m or int(m["f0"]) <= 0 or int(m["k"]) != 1:
            continue
        out.setdefault(m["id"], []).append({"f0": float(m["f0"]), "wps": float(m["wps"]), "spread": None,
                                            "wer": float(m["wer"]), "rate_ok": float(m["wps"]) > 0})
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("runs", nargs="*", help="tune.py result files (scratch/tune/<tag>.json)")
    ap.add_argument("--log", default=None, help="use the takes in this generate.log instead of tune.py runs")
    ap.add_argument("--voices", default=str(HERE / "voices.json"))
    ap.add_argument("--voice", action="append", help="only these voices")
    ap.add_argument("--exclude", action="append", default=[], help="skip these voices (their description changed since this run)")
    ap.add_argument("--variant", default=None, help="only rows of this variant label (tune.py runs)")
    ap.add_argument("--st", type=float, default=3.0, help="pitch band half width in semitones")
    ap.add_argument("--rate-pct", type=float, default=30.0, help="pace band half width in percent")
    ap.add_argument("--min-n", type=int, default=4)
    ap.add_argument("--write", action="store_true", help="write the proposed f0 and wps bands into voices.json")
    args = ap.parse_args()
    if not args.runs and not args.log:
        ap.error("give tune.py result files or --log generate.log")

    takes = takes_from_log(args.log) if args.log else takes_from_runs(args.runs, args.variant)
    voices = json.load(open(args.voices))
    stats = {}
    print("%-10s %3s %8s %14s %6s   %-14s %-12s | %s" % ("voice", "n", "F0 med", "p10-p90 Hz", "wps", "f0 band", "wps band", "old bands"))
    for vid, rows in takes.items():
        rows = [r for r in rows if r["wer"] <= 0.10]
        if vid not in voices or vid in args.exclude or (args.voice and vid not in args.voice):
            continue
        if len(rows) < args.min_n:
            print("%-10s %3d  (skipped: too few usable takes)" % (vid, len(rows)))
            continue
        f0s = sorted(r["f0"] for r in rows)
        m = statistics.median(f0s)
        p10, p90 = f0s[int(0.1 * (len(f0s) - 1))], f0s[int(round(0.9 * (len(f0s) - 1)))]
        rates = [r["wps"] for r in rows if r["rate_ok"]]
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
            spreads = [r["spread"] for r in rows if r["spread"] is not None]
            if "f0_std_st" in old and spreads:
                tgt["f0_std_st"] = [0, round(max(2.0, 1.2 * statistics.median(spreads)), 1)]
            voices[vid]["target"] = tgt

    print("\ncast map, lowest to highest median pitch (gap = semitones to the next voice):")
    ordered = sorted(stats.items(), key=lambda kv: kv[1][0])
    for i, (vid, (m, _, _)) in enumerate(ordered):
        gap = 12 * math.log2(ordered[i + 1][1][0] / m) if i + 1 < len(ordered) else None
        twin = "  <- close to the next voice" if gap is not None and gap < 1.0 else ""
        print("  %-10s %6.0f Hz  %s%s" % (vid, m, "" if gap is None else "+%.1f st" % gap, twin))

    if args.write:
        Path(args.voices).write_text(dump_voices(voices), encoding="utf-8")
        print("\nwrote bands for %d voices to %s" % (len(stats), args.voices))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
