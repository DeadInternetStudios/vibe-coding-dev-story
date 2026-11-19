#!/usr/bin/env python3
"""Does every line still sound like its own voice, and not like another character?

Embeds each rendered MP3 with the Qwen3-TTS Base model's speaker encoder (the file the game loads, decoded;
nothing is played), subtracts the cast-wide mean embedding (raw cosines are all high and say little),
and compares each line with every voice's centroid.

    .venv/bin/python castcheck.py                       # whole manifest in public/audio/vo
    .venv/bin/python castcheck.py --list-misfits        # also print the lines nearer another voice
    .venv/bin/python castcheck.py --json scratch/castcheck.json
    .venv/bin/python castcheck.py --save ident.json --annotate-state render-state.json

Per voice: lines, mean cosine to its own centroid ("cohesion"), the share of lines whose nearest centroid is
their own voice ("identifiable"), and the most similar other voice. A misfit is a line nearer another voice's
centroid than its own: a retake candidate (`generate.py --polish` retakes them).

`--save ident.json` stores the cast mean and every voice's centroid (voices with at least 5 lines); generate.py
loads that file and scores every new take against it, so a take that sounds like another character is retried.
`--annotate-state render-state.json` records each existing line's score there (`idz`, `idm`) so that
`generate.py --polish` can find the misfits among lines rendered before ident.json existed.
Stop watch.sh and any generate.py run before annotating: both write that file.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib import audio, ident, tts  # noqa: E402
from ttslib import manifest as mf  # noqa: E402


def embed_all(paths: list[Path]) -> np.ndarray:
    from mlx_audio.tts.utils import load_model

    base = load_model(tts.BASE_REPO)
    return np.stack([ident.embed(base, audio.decode_audio(p)) for p in paths])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(HERE.parent.parent / "public" / "audio" / "vo"))
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--list-misfits", action="store_true")
    ap.add_argument("--json", default=None, help="write the numbers here")
    ap.add_argument("--save", default=None, help="write the cast mean and voice centroids here (ident.json)")
    ap.add_argument("--annotate-state", default=None, help="add each line's identity score to this render-state.json")
    args = ap.parse_args()

    out_dir = Path(args.out)
    manifest = json.loads(Path(args.manifest or out_dir / "manifest.json").read_text(encoding="utf-8"))
    ids = sorted(manifest["lines"])
    voices = sorted({manifest["lines"][i]["voice"] for i in ids})
    if len(voices) < 2:
        print("need at least two voices rendered")
        return 1

    raw = embed_all([out_dir / manifest["lines"][i]["file"] for i in ids])
    emb = raw - raw.mean(axis=0, keepdims=True)
    emb /= np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9
    owner = np.array([voices.index(manifest["lines"][i]["voice"]) for i in ids])

    cent = np.stack([emb[owner == k].mean(axis=0) for k in range(len(voices))])
    cent /= np.linalg.norm(cent, axis=1, keepdims=True) + 1e-9
    sim = emb @ cent.T  # lines x voices
    nearest = sim.argmax(axis=1)

    report = {}
    print("%-10s %3s %9s %12s   %s" % ("voice", "n", "cohesion", "identifiable", "most similar other voice"))
    for k, v in enumerate(voices):
        mine = np.where(owner == k)[0]
        own = sim[mine, k]
        share = float((nearest[mine] == k).mean())
        cc = cent @ cent[k]
        cc[k] = -9
        j = int(cc.argmax())
        report[v] = {"n": int(len(mine)), "cohesion": round(float(own.mean()), 3), "identifiable": round(share, 3),
                     "closest_voice": voices[j], "closest_cos": round(float(cc[j]), 3)}
        print("%-10s %3d %9.3f %11.0f%%   %s (%.2f)" % (v, len(mine), own.mean(), 100 * share, voices[j], cc[j]))
    total = float((nearest == owner).mean())
    print("\n%d lines, %.0f%% are nearest to their own voice's centroid" % (len(ids), 100 * total))

    misfits = [(ids[i], voices[owner[i]], voices[nearest[i]], float(sim[i, owner[i]]), float(sim[i, nearest[i]]))
               for i in range(len(ids)) if nearest[i] != owner[i]]
    if args.list_misfits and misfits:
        print("\nlines nearer another voice (id, own, nearest, cos own, cos nearest):")
        for m in sorted(misfits, key=lambda m: m[3] - m[4]):
            print("  %s  %s -> %s  %.2f vs %.2f  | %s" % (m[0], m[1], m[2], m[3], m[4], manifest["lines"][m[0]]["text"][:50]))
    if args.save or args.annotate_state:
        data = ident.build(raw, [manifest["lines"][i]["voice"] for i in ids])
        if args.save:
            Path(args.save).write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
            print("\nsaved the centroids of %d voices to %s" % (len(data["voices"]), args.save))
        if args.annotate_state:
            idn = ident.Identity(data)
            state = mf.load_state(args.annotate_state)
            n = 0
            for k, i in enumerate(ids):
                sc = idn.score_embedding(manifest["lines"][i]["voice"], raw[k])
                rec = state["lines"].get(i)
                if sc is not None and rec is not None:
                    rec["idz"], rec["idm"] = round(sc["z"], 2), round(sc["margin"], 3)
                    n += 1
            mf.save_state(args.annotate_state, state)
            print("annotated %d lines in %s" % (n, args.annotate_state))
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps({"voices": report, "identifiable_total": round(total, 3),
                                               "misfits": [m[0] for m in misfits]}, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
