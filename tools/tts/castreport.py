"""The cast in numbers, as a Markdown table: one row per voice, from the manifest and render-state.json.

    .venv/bin/python castreport.py                                     # table on stdout
    .venv/bin/python castreport.py --identity scratch/castcheck.json   # identifiable share from a fresh castcheck

Columns: lines in the manifest, minutes of audio, median pitch (Hz), median pace (words per second), mean WER,
mean loudness (LUFS), the share of lines inside the voice's pitch band, the lines the gate still calls weak,
the share of lines nearest to their own voice's centroid, and a one-line description of how the voice sounds.
The "identifiable" share comes from the `idm` scores that `castcheck.py --annotate-state` (or generate.py's
identity gate) wrote into render-state.json; `--identity` takes the file `castcheck.py --json` writes instead.
"""
import argparse
import json
import statistics as st
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "public" / "audio" / "vo"

SOUNDS = {
    "clod": "bright, quick, androgynous young adult with a customer-service smile",
    "chad": "confident chest voice, motivational cadence, a little breathless",
    "dave": "gravelly, tired, flat deadpan",
    "jenny": "young, breathy, anxious, up-talking, very fast",
    "automod": "flat robotic monotone, metronome pace",
    "announcer": "deep, bombastic awards-show baritone",
    "narrator": "elderly British, hushed nature-documentary whisper",
    "vc": "smooth, low, unhurried, condescending, lazy vowels",
    "karen": "harsh, nasal, indignant, escalating",
    "bro": "loud hyped gym voice, fast, very wide pitch range",
    "pedant": "nasal, smug, fast",
    "doomer": "monotone, whispery, defeated, long sighs",
    "linkedin": "breathy, over-emotional, slow dramatic pauses",
    "arch": "nasal smug mumble, low energy",
    "ghost": "hollow airy whisper, disappointed",
    "duck": "tiny squeaky cartoon duck",
    "hacker": "sub-bass villain growl, slow, menacing",
    "wholesome": "warm soft baritone, a little teary",
    "grandma": "sweet elderly woman, slow, delighted, a quaver",
    "kid": "ten year old, fast, thrilled, breathless",
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--state", default=str(HERE / "render-state.json"))
    ap.add_argument("--voices", default=str(HERE / "voices.json"))
    ap.add_argument("--identity", default=None, help="the file castcheck.py --json wrote")
    args = ap.parse_args()

    out_dir = Path(args.out)
    lines = json.loads(Path(args.manifest or out_dir / "manifest.json").read_text(encoding="utf-8"))["lines"]
    state = json.loads(Path(args.state).read_text(encoding="utf-8"))["lines"]
    voices = json.loads(Path(args.voices).read_text(encoding="utf-8"))
    ident = json.loads(Path(args.identity).read_text(encoding="utf-8"))["voices"] if args.identity else {}

    print("| voice | lines | minutes | median Hz | words/s | mean WER | LUFS | in band | weak | identifiable | sounds like |")
    print("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    total = weak_total = 0
    for vid, voice in voices.items():
        ids = [i for i, e in lines.items() if e["voice"] == vid]
        if not ids:
            continue
        recs = [state[i] for i in ids if i in state]
        f0 = [r["f0"] for r in recs if r.get("f0", 0) > 0]
        wps = [r["wps"] for r in recs if r.get("wps", 0) > 0]
        lufs = [r["lufs"] for r in recs if r.get("lufs")]
        lo, hi = (voice.get("target") or {}).get("f0", [0, 0])
        in_band = sum(1 for r in recs if lo * 0.97 <= r.get("f0", 0) <= hi * 1.03)
        weak = sum(1 for r in recs if r.get("bad", 0.0) >= 1.0)
        total += len(ids)
        weak_total += weak
        known = ident.get(vid, {}).get("identifiable")
        margins = [r["idm"] for r in recs if "idm" in r]
        if known is None and margins:
            known = sum(1 for m in margins if m >= 0) / len(margins)
        print("| `%s` %s | %d | %.1f | %.0f | %.2f | %.3f | %.1f | %.0f%% | %d | %s | %s |" % (
            vid, voice["name"], len(ids), sum(lines[i]["dur"] for i in ids) / 60,
            st.median(f0) if f0 else 0, st.median(wps) if wps else 0,
            sum(lines[i]["wer"] for i in ids) / len(ids), st.mean(lufs) if lufs else 0,
            100 * in_band / max(1, len(recs)), weak, ("%.0f%%" % (100 * known)) if known is not None else "n/a",
            SOUNDS.get(vid, "")))
    print("\n%d lines, %d still weak" % (total, weak_total))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
