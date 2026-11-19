#!/usr/bin/env python3
"""Build lines.seed.json from cast.seed.md.

Format of cast.seed.md: a `## <voice id>` heading starts a voice, prose lines after it are
sound notes, and every `- text [delivery]` bullet is one line. A trailing square-bracket
note is the `delivery`. Ids follow docs/voice-contract.md (ttslib.lineid).

Standard library only, so it runs with any python3:

    python3 tools/tts/build_seed.py            # rewrites tools/tts/lines.seed.json
    python3 tools/tts/build_seed.py --check    # exit 1 if the file is out of date
"""
import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from ttslib.lineid import line_id  # noqa: E402

BULLET = re.compile(r"^-\s+(?P<text>.*?)(?:\s+\[(?P<delivery>[^\]]+)\])?\s*$")


def parse_cast(path):
    voice = None
    notes = {}
    lines = []
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            raw = raw.rstrip("\n")
            if raw.startswith("## "):
                voice = raw[3:].strip()
                notes[voice] = []
                continue
            if voice is None:
                continue
            m = BULLET.match(raw)
            if m:
                entry = {"voice": voice, "text": m.group("text").strip()}
                if m.group("delivery"):
                    entry["delivery"] = m.group("delivery").strip()
                lines.append(entry)
            elif raw.strip():
                notes[voice].append(raw.strip())
    return lines, notes


def build(path):
    lines, _ = parse_cast(path)
    out = []
    for e in lines:
        row = {"id": line_id(e["voice"], e["text"], e.get("delivery")), "voice": e["voice"], "text": e["text"]}
        if "delivery" in e:
            row["delivery"] = e["delivery"]
        out.append(row)
    return {"version": 1, "lines": out}


def dump(doc):
    """One line per entry: stable, readable diffs."""
    rows = ",\n".join("  " + json.dumps(r, ensure_ascii=False, separators=(", ", ": ")) for r in doc["lines"])
    return '{\n "version": %d,\n "lines": [\n%s\n ]\n}\n' % (doc["version"], rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cast", default=os.path.join(HERE, "cast.seed.md"))
    ap.add_argument("--out", default=os.path.join(HERE, "lines.seed.json"))
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    text = dump(build(args.cast))
    if args.check:
        have = open(args.out, encoding="utf-8").read() if os.path.exists(args.out) else ""
        if have != text:
            print("lines.seed.json is out of date, run build_seed.py", file=sys.stderr)
            sys.exit(1)
        print("lines.seed.json is up to date")
        return
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(text)
    doc = json.loads(text)
    per = {}
    for r in doc["lines"]:
        per[r["voice"]] = per.get(r["voice"], 0) + 1
    print("wrote %s: %d lines, %d voices" % (args.out, len(doc["lines"]), len(per)))
    print(", ".join("%s=%d" % kv for kv in per.items()))


if __name__ == "__main__":
    main()
