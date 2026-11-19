#!/usr/bin/env python3
"""Does every line still sound like its own voice, and not like another character?

Embeds each rendered MP3 with the Qwen3-TTS Base model's speaker encoder (the file the game loads, decoded;
nothing is played), subtracts the cast-wide mean embedding (raw cosines are all high and say little),
and compares each line with every voice's centroid.

    .venv/bin/python castcheck.py                       # whole manifest in public/audio/vo
    .venv/bin/python castcheck.py --list-misfits        # also print the lines nearer another voice
    .venv/bin/python castcheck.py --json scratch/castcheck.json

Per voice: lines, mean cosine to its own centroid ("cohesion"), the share of lines whose nearest centroid is
their own voice ("identifiable"), and the most similar other voice. A misfit is a line nearer another voice's
centroid than its own: a retake candidate (`generate.py --redo-id ID`).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib import audio, tts  # noqa: E402


def embed_all(paths: list[Path]) -> np.ndarray:
    import mlx.core as mx
    from mlx_audio.tts.utils import load_model

    base = load_model(tts.BASE_REPO)
    out = []
    for p in paths:
        wav = audio.decode_audio(p)
        e = np.array(base.extract_speaker_embedding(mx.array(wav)), dtype=np.float32).reshape(-1)
        out.append(e / (np.linalg.norm(e) + 1e-9))
    return np.stack(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(HERE.parent.parent / "public" / "audio" / "vo"))
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--list-misfits", action="store_true")
    ap.add_argument("--json", default=None, help="write the numbers here")
    args = ap.parse_args()

    out_dir = Path(args.out)
    manifest = json.loads(Path(args.manifest or out_dir / "manifest.json").read_text(encoding="utf-8"))
    ids = sorted(manifest["lines"])
    voices = sorted({manifest["lines"][i]["voice"] for i in ids})
    if len(voices) < 2:
        print("need at least two voices rendered")
        return 1

    emb = embed_all([out_dir / manifest["lines"][i]["file"] for i in ids])
    emb = emb - emb.mean(axis=0, keepdims=True)
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
        ident = float((nearest[mine] == k).mean())
        cc = cent @ cent[k]
        cc[k] = -9
        j = int(cc.argmax())
        report[v] = {"n": int(len(mine)), "cohesion": round(float(own.mean()), 3), "identifiable": round(ident, 3),
                     "closest_voice": voices[j], "closest_cos": round(float(cc[j]), 3)}
        print("%-10s %3d %9.3f %11.0f%%   %s (%.2f)" % (v, len(mine), own.mean(), 100 * ident, voices[j], cc[j]))
    total = float((nearest == owner).mean())
    print("\n%d lines, %.0f%% are nearest to their own voice's centroid" % (len(ids), 100 * total))

    misfits = [(ids[i], voices[owner[i]], voices[nearest[i]], float(sim[i, owner[i]]), float(sim[i, nearest[i]]))
               for i in range(len(ids)) if nearest[i] != owner[i]]
    if args.list_misfits and misfits:
        print("\nlines nearer another voice (id, own, nearest, cos own, cos nearest):")
        for m in sorted(misfits, key=lambda m: m[3] - m[4]):
            print("  %s  %s -> %s  %.2f vs %.2f  | %s" % (m[0], m[1], m[2], m[3], m[4], manifest["lines"][m[0]]["text"][:50]))
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(json.dumps({"voices": report, "identifiable_total": round(total, 3),
                                               "misfits": [m[0] for m in misfits]}, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
