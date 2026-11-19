#!/usr/bin/env python3
"""Check public/audio/vo against docs/voice-contract.md. Standard library plus ffprobe, nothing is played.

    python3 tools/tts/verify.py                         # manifest in public/audio/vo; lines files: lines.json, the last
                                                        # watch.sh export (scratch/export), lines.seed.json, lines.extra.json
    python3 tools/tts/verify.py --out DIR --lines lines.json lines.seed.json

Errors (exit code 1): bad manifest shape, line id that does not match the contract formula, missing or
unreadable MP3, `dur` that differs from the MP3's real duration, `env` or `words` of the wrong length,
stereo or over-bitrate files. Warnings: WER above 0.25, MP3 files the manifest does not list, manifest lines
no lines file asks for. The manifest does not store delivery notes, so the id of a line with a note can only be
checked against a lines file that lists it; an unknown line whose id does not fit is a warning, not an error.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from ttslib.lineid import line_id  # noqa: E402

REPO = HERE.parent.parent
ID_RE = re.compile(r"^[a-z0-9]+-[0-9a-f]{8}$")


def ffprobe_path() -> str | None:
    return shutil.which("ffprobe") or ("/opt/homebrew/bin/ffprobe" if Path("/opt/homebrew/bin/ffprobe").exists() else None)


def probe(ffprobe: str, path: Path) -> dict:
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration,bit_rate:stream=codec_name,sample_rate,channels",
         "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    s = (j.get("streams") or [{}])[0]
    return {"dur": float(j["format"]["duration"]), "kbps": float(j["format"].get("bit_rate", 0)) / 1000,
            "ch": int(s.get("channels", 0)), "sr": int(s.get("sample_rate", 0)), "codec": s.get("codec_name")}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(REPO / "public" / "audio" / "vo"))
    ap.add_argument("--manifest", default=None)
    ap.add_argument("--lines", nargs="*", default=None, help="lines files that say what should exist (delivery notes come from here)")
    ap.add_argument("--no-probe", action="store_true", help="skip ffprobe (durations and channels are not checked)")
    args = ap.parse_args()

    out_dir = Path(args.out)
    mpath = Path(args.manifest) if args.manifest else out_dir / "manifest.json"
    errors: list[str] = []
    warnings: list[str] = []

    try:
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print("cannot read %s: %s" % (mpath, exc))
        return 1
    if manifest.get("version") != 1:
        errors.append("manifest.version is %r, expected 1" % manifest.get("version"))
    voices = manifest.get("voices")
    lines = manifest.get("lines")
    if not isinstance(voices, dict) or not isinstance(lines, dict):
        print("manifest needs `voices` and `lines` objects")
        return 1
    for vid, v in voices.items():
        if not isinstance(v, dict) or not isinstance(v.get("name"), str):
            errors.append("voices.%s needs a string `name`" % vid)

    wanted: dict[str, dict] = {}
    lines_files = [Path(p) for p in args.lines] if args.lines else [
        HERE / n for n in ("lines.json", "scratch/export/tools/tts/lines.json", "lines.seed.json", "lines.extra.json")]
    for p in lines_files:
        if p.exists():
            for ln in json.loads(p.read_text(encoding="utf-8")).get("lines", []):
                wanted.setdefault(ln["id"], ln)

    ffprobe = None if args.no_probe else ffprobe_path()
    if not args.no_probe and not ffprobe:
        warnings.append("ffprobe not found: durations and channels not checked")

    n_ok = 0
    for lid, e in sorted(lines.items()):
        errs = []
        for key in ("voice", "text", "file", "dur", "env", "wer"):
            if key not in e:
                errs.append("missing `%s`" % key)
        if errs:
            errors.append("%s: %s" % (lid, ", ".join(errs)))
            continue
        if not ID_RE.match(lid):
            errs.append("id is not voice-hex8")
        if e["voice"] not in voices:
            errs.append("voice %r is not in manifest.voices" % e["voice"])
        known = wanted.get(lid)
        delivery = (known or {}).get("delivery")
        if line_id(e["voice"], e["text"], delivery) != lid:
            if known is None:
                warnings.append("%s: id is not voice|text without a delivery note; fine if the line has a note that no lines file lists" % lid)
            else:
                errs.append("id does not match the contract formula for voice|text|delivery (delivery=%r)" % delivery)
        if e["file"] != lid + ".mp3":
            errs.append("file is %r, expected %s.mp3" % (e["file"], lid))
        f = out_dir / e["file"]
        if not f.exists():
            errs.append("file is missing")
        elif ffprobe:
            try:
                info = probe(ffprobe, f)
                if abs(info["dur"] - e["dur"]) > 0.03:
                    errs.append("dur %.2f but the MP3 is %.3f s" % (e["dur"], info["dur"]))
                if info["codec"] != "mp3":
                    errs.append("codec is %s" % info["codec"])
                if info["ch"] != 1:
                    errs.append("%d channels, expected mono" % info["ch"])
                if info["kbps"] > 66:
                    errs.append("bitrate %.0f kbps is over 64" % info["kbps"])
            except Exception as exc:  # noqa: BLE001
                errs.append("ffprobe failed: %s" % exc)
        if round(e["dur"], 2) != e["dur"] or e["dur"] <= 0:
            errs.append("dur %r is not positive with at most 2 decimals" % e["dur"])
        env = e["env"]
        if not isinstance(env, str) or not re.fullmatch(r"[0-9a-f]+", env):
            errs.append("env is not a hex string")
        elif abs(len(env) - round(e["dur"] * 20)) > 1:
            errs.append("env has %d digits for %.2f s (expected about %d at 20 per second)" % (len(env), e["dur"], round(e["dur"] * 20)))
        words = e.get("words")
        if words is not None:
            nw = len(e["text"].split())
            if len(words) != nw:
                errs.append("words has %d pairs for %d words" % (len(words), nw))
            else:
                prev = -1.0
                for a, b in words:
                    if not (0 <= a <= b <= e["dur"] + 0.05) or a < prev - 1e-6:
                        errs.append("words timings out of order or out of range")
                        break
                    prev = a
        if not isinstance(e["wer"], (int, float)) or e["wer"] < 0:
            errs.append("wer must be a number >= 0")
        elif e["wer"] > 0.25:
            warnings.append("%s: wer %.2f is above the 0.25 acceptance line | %s" % (lid, e["wer"], e["text"][:50]))
        if errs:
            errors.append("%s: %s" % (lid, "; ".join(errs)))
        else:
            n_ok += 1

    on_disk = {p.name for p in out_dir.glob("*.mp3")}
    listed = {e.get("file") for e in lines.values()}
    for name in sorted(on_disk - listed):
        warnings.append("%s is on disk but not in the manifest" % name)
    if wanted:
        missing = sorted(set(wanted) - set(lines))
        if missing:
            warnings.append("%d of %d wanted lines are not rendered yet (first: %s)" % (len(missing), len(wanted), ", ".join(missing[:3])))
        for lid in sorted(set(lines) - set(wanted)):
            warnings.append("%s is in the manifest but no lines file asks for it" % lid)

    for w in warnings[:40]:
        print("warning:", w)
    if len(warnings) > 40:
        print("warning: ... and %d more" % (len(warnings) - 40))
    for e_ in errors:
        print("ERROR:", e_)
    print("%d lines checked, %d clean, %d with errors, %d warnings" % (len(lines), n_ok, len(errors), len(warnings)))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
