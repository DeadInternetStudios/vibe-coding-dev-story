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


PAIRS = [("cast.seed.md", "lines.seed.json"), ("cast.extra.md", "lines.extra.json")]


def build_one(cast, out, check):
    text = dump(build(cast))
    name = os.path.basename(out)
    if check:
        have = open(out, encoding="utf-8").read() if os.path.exists(out) else ""
        if have != text:
            print("%s is out of date, run build_seed.py --all" % name, file=sys.stderr)
            return False
        print("%s is up to date" % name)
        return True
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(text)
    doc = json.loads(text)
    per = {}
    for r in doc["lines"]:
        per[r["voice"]] = per.get(r["voice"], 0) + 1
    print("wrote %s: %d lines, %d voices" % (name, len(doc["lines"]), len(per)))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cast", default=None, help="markdown cast file (default cast.seed.md)")
    ap.add_argument("--out", default=None, help="json file to write (default lines.seed.json)")
    ap.add_argument("--all", action="store_true", help="cast.seed.md -> lines.seed.json and cast.extra.md -> lines.extra.json")
    ap.add_argument("--check", action="store_true", help="exit 1 if a json file is out of date")
    args = ap.parse_args()

    if args.all:
        pairs = [(os.path.join(HERE, c), os.path.join(HERE, o)) for c, o in PAIRS]
    else:
        pairs = [(args.cast or os.path.join(HERE, PAIRS[0][0]), args.out or os.path.join(HERE, PAIRS[0][1]))]
    ok = all([build_one(c, o, args.check) for c, o in pairs])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
