#!/usr/bin/env python3
"""Do the node renders and the Chromium renders agree?

The numbers everyone relies on (loudness, peak, tone) come from node-web-audio-api.
The game plays on the browser's audio stack, so the same sounds are rendered in
headless Chromium and compared here. Both sides go through analyze.py.

    npx tsx tools/audio/render.ts sfx click coin --backend chromium --out tools/audio/out/chromium
    tools/audio/.venv/bin/python tools/audio/analyze.py --out tools/audio/out/chromium --no-notes --no-png
    tools/audio/.venv/bin/python tools/audio/crosscheck.py

Exit status is 1 when any sound differs by more than the tolerances.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(path: Path) -> dict[str, dict]:
    if not path.exists():
        sys.exit(f"missing {path}; analyze that render first")
    return {r["name"]: r for r in json.loads(path.read_text()) if not r.get("solo")}


def loudness(r: dict) -> float | None:
    """The one loudness figure analyze.py judges this kind of sound by."""
    if r["group"] == "sfx":
        return r.get("lufs_event")
    return r.get("lufs_loop") if r.get("lufs_loop") is not None else r.get("lufs_i")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--node", default=str(HERE / "out" / "analysis.json"))
    ap.add_argument("--chromium", default=str(HERE / "out" / "chromium" / "analysis.json"))
    ap.add_argument("--tol-lufs", type=float, default=1.5, help="dB")
    ap.add_argument("--tol-peak", type=float, default=1.5, help="dB")
    ap.add_argument("--tol-centroid", type=float, default=0.15, help="fraction")
    args = ap.parse_args()

    node = load(Path(args.node))
    chrome = load(Path(args.chromium))
    names = sorted(set(node) & set(chrome))
    if not names:
        sys.exit("no sound appears in both analyses")

    rows = []
    bad = 0
    print(f"{'name':<22} {'LUFS node':>9} {'chrome':>8} {'d':>6}   {'peak node':>9} {'chrome':>8} {'d':>6}   {'centroid':>8} {'chrome':>8} {'d%':>6}")
    for n in names:
        a, b = node[n], chrome[n]
        la, lb = loudness(a), loudness(b)
        dl = None if la is None or lb is None else lb - la
        dp = b["peak_db"] - a["peak_db"]
        dc = (b["centroid"] - a["centroid"]) / max(a["centroid"], 1.0)
        flag = []
        if dl is not None and abs(dl) > args.tol_lufs:
            flag.append("LUFS")
        if abs(dp) > args.tol_peak:
            flag.append("PEAK")
        if abs(dc) > args.tol_centroid:
            flag.append("TONE")
        bad += bool(flag)
        rows.append((n, dl, dp, dc))
        print(
            f"{n:<22} {la if la is not None else float('nan'):9.1f} {lb if lb is not None else float('nan'):8.1f} {dl if dl is not None else float('nan'):+6.1f}   "
            f"{a['peak_db']:9.1f} {b['peak_db']:8.1f} {dp:+6.1f}   {a['centroid']:8.0f} {b['centroid']:8.0f} {dc * 100:+6.1f}  {' '.join(flag)}"
        )

    dls = [abs(d) for _, d, _, _ in rows if d is not None]
    print()
    print(f"{len(names)} sounds compared. worst loudness gap {max(dls):.2f} dB, worst peak gap {max(abs(p) for _, _, p, _ in rows):.2f} dB, worst centroid gap {max(abs(c) for *_, c in rows) * 100:.1f}%")
    print(f"mean loudness gap {sum(d for _, d, _, _ in rows if d is not None) / max(len(dls), 1):+.2f} dB (chromium minus node)")
    if bad:
        print(f"{bad} sound(s) outside tolerance")
        return 1
    print("all within tolerance")
    return 0


if __name__ == "__main__":
    sys.exit(main())
