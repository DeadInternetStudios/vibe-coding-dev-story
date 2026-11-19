#!/usr/bin/env python3
"""Render every voiced line to a small MP3 with Qwen3-TTS-12Hz-1.7B-VoiceDesign.

For each line without a valid MP3 in the output it: renders a take, trims silence, matches
loudness per voice, encodes mono MP3, then runs speech to text on that very MP3 and scores it
against the text. Bad takes (too many word errors, runaway, clipping, a voice that drifted out
of its intent band) are retried with other seeds, at most 4 takes, the best take is kept. The
manifest is rewritten atomically after EVERY line, so a crash loses nothing.

    .venv/bin/python generate.py                       # all lines of lines.json (or lines.seed.json)
    .venv/bin/python generate.py --only dave --limit 3
    nohup .venv/bin/python generate.py > /dev/null 2>&1 &   # background; progress in generate.log

Run it from another checkout against the main checkout's files:

    tools/tts/.venv/bin/python tools/tts/generate.py \\
        --lines /path/to/main/tools/tts/lines.json \\
        --out /path/to/main/public/audio/vo --manifest /path/to/main/public/audio/vo/manifest.json

Never plays audio. See README.md.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import signal
import sys
import time
import traceback
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

from ttslib import audio, qa, stt  # noqa: E402
from ttslib import manifest as mf  # noqa: E402
from ttslib.lineid import fnv1a32, line_id  # noqa: E402

PIPELINE_VERSION = 1
DEFAULT_SAMPLING = {"temperature": 0.7, "top_k": 40}
STOP = False
log = logging.getLogger("vo")


# --------------------------------------------------------------------------- inputs


def read_lines_file(path: Path) -> list:
    doc = json.loads(path.read_text(encoding="utf-8"))
    rows = doc["lines"] if isinstance(doc, dict) else doc
    return rows


def load_lines(paths: list) -> list:
    """Union of the lines files by id, first file first. Ids come from the file; a mismatch with
    the contract formula is logged loudly (the file wins, the game looks lines up by its own id)."""
    seen, out = set(), []
    for p in paths:
        rows = read_lines_file(Path(p))
        n_new = 0
        for r in rows:
            if not isinstance(r, dict) or not r.get("voice") or not isinstance(r.get("text"), str) or not r["text"].strip():
                log.warning("skipping malformed line in %s: %r", p, r)
                continue
            delivery = r.get("delivery") or None
            want = line_id(r["voice"], r["text"], delivery)
            rid = r.get("id") or want
            if rid != want:
                log.error("ID MISMATCH in %s: file says %s, contract formula gives %s for voice=%r text=%r delivery=%r",
                          p, rid, want, r["voice"], r["text"], delivery)
            if rid in seen:
                continue
            seen.add(rid)
            out.append({"id": rid, "voice": r["voice"], "text": r["text"], "delivery": delivery})
            n_new += 1
        log.info("%s: %d lines (%d new after merging)", p, len(rows), n_new)
    return out


def default_lines_paths() -> list:
    main = HERE / "lines.json"
    if main.exists():
        try:
            if read_lines_file(main):
                return [main]
        except (ValueError, KeyError):
            pass
    return [HERE / "lines.seed.json"]


# --------------------------------------------------------------------------- signatures


def _sha(obj) -> str:
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]


def voice_sampling(voice: dict) -> dict:
    return {**DEFAULT_SAMPLING, **(voice.get("sampling") or {})}


def ref_paths(voice_id: str):
    return HERE / "refs" / f"{voice_id}.flac", HERE / "refs" / f"{voice_id}.txt"


def voice_sig(voice_id: str, voice: dict) -> str:
    """Changes when the way a voice is RENDERED changes. A different sig means re-render."""
    payload = {"d": voice["description"], "s": voice_sampling(voice), "r": voice.get("route", "design"), "v": PIPELINE_VERSION}
    if voice.get("route") == "clone":
        flac, txt = ref_paths(voice_id)
        payload["ref"] = hashlib.sha1(flac.read_bytes() + txt.read_bytes()).hexdigest()[:8] if flac.exists() and txt.exists() else None
    return _sha(payload)


def master_sig(voice: dict, kbps: int) -> str:
    """Changes when only trimming, loudness or encoding changes. A raw take can be remastered."""
    return _sha({"trim": voice.get("trim", 0.0), "lufs": audio.TARGET_LUFS, "ceil": audio.PEAK_CEILING_DB, "kbps": kbps, "v": PIPELINE_VERSION})


def seed_for(line_id_: str, attempt: int) -> int:
    return (fnv1a32(line_id_.encode()) + 7919 * attempt) & 0x7FFFFFFF


# --------------------------------------------------------------------------- one take


@dataclass
class Attempt:
    k: int
    seed: int
    path: Path
    decoded: object
    transcript: object
    score: object
    assessment: object
    rtf: float
    gain_db: float
    tokens: int


def finish_take(raw, sr: int, line: dict, voice: dict, st: stt.Stt, tmp: Path, kbps: int, capped: bool,
                accept_wer: float, k: int, seed: int, rtf: float, tokens: int) -> Attempt:
    x = audio.trim_silence(raw, sr)
    y, gain, _ = audio.match_loudness(x, sr, trim_db=float(voice.get("trim", 0.0)))
    audio.encode_mp3(y, sr, tmp, kbps)
    decoded = audio.decode_audio(tmp, sr)
    tr = st.transcribe(tmp)
    sc = stt.score(line["text"], tr.text)
    a = qa.assess(decoded, sr, line["text"], voice, sc, capped, accept_wer)
    return Attempt(k, seed, tmp, decoded, tr, sc, a, rtf, gain, tokens)


def entry_from(line: dict, att: Attempt, sr: int) -> dict:
    dur = round(len(att.decoded) / sr, 2)
    entry = {
        "voice": line["voice"],
        "text": line["text"],
        "file": f"{line['id']}.mp3",
        "dur": dur,
        "env": audio.envelope_hex(att.decoded, sr),
    }
    words = stt.word_times(line["text"], att.transcript.words, dur)
    if len(words) == len(line["text"].split()):
        entry["words"] = words
    entry["wer"] = round(att.score.wer, 3)
    return entry


def state_from(line: dict, voice: dict, att: Attempt, attempts: int, kbps: int, route: str, note: str = "") -> dict:
    m = att.assessment.metrics
    s = {
        "sig": voice_sig(line["voice"], voice), "msig": master_sig(voice, kbps), "route": route, "seed": att.seed,
        "attempts": attempts, "bad": att.assessment.badness, "f0": m["f0_med"], "wps": m["wps"],
        "lufs": m["lufs"], "peak": m["peak_db"], "rtf": round(att.rtf, 2), "ts": int(time.time()),
    }
    if att.assessment.problems:
        s["problems"] = att.assessment.problems
    if note:
        s["note"] = note
    return s


# --------------------------------------------------------------------------- rendering


def render_line(line: dict, voice: dict, eng, st: stt.Stt, args, out_dir: Path, takes_dir: Path):
    """Up to args.attempts takes. Returns (best Attempt, attempts used, route)."""
    from ttslib import tts

    route = voice.get("route", "design")
    sampling = voice_sampling(voice)
    sr = tts.SAMPLE_RATE
    best = None
    used = 0
    ref = None
    if route == "clone":
        import soundfile as sf

        flac, txt = ref_paths(line["voice"])
        ref = (sf.read(flac, dtype="float32")[0], txt.read_text(encoding="utf-8").strip())
        if line["delivery"]:
            log.info("%s: clone route ignores delivery %r (Base has no instruct)", line["id"], line["delivery"])
    instruct = tts.compose_instruct(voice["description"], line["delivery"])

    for k in range(args.attempts):
        if STOP:
            break
        seed = seed_for(line["id"], k)
        try:
            if route == "clone":
                take = eng.clone(ref[0], ref[1], line["text"], seed, **sampling)
            else:
                take = eng.design(instruct, line["text"], seed, **sampling)
        except Exception:
            log.error("%s attempt %d: render crashed\n%s", line["id"], k + 1, traceback.format_exc())
            continue
        used += 1
        if take is None:
            log.warning("%s attempt %d: model returned no audio", line["id"], k + 1)
            continue
        tmp = out_dir / f".{line['id']}.try{k}.mp3"
        try:
            att = finish_take(take.wav, sr, line, voice, st, tmp, args.kbps, take.hit_cap, args.accept_wer, k, seed, take.rtf, take.tokens)
        except Exception:
            log.error("%s attempt %d: post-processing crashed\n%s", line["id"], k + 1, traceback.format_exc())
            tmp.unlink(missing_ok=True)
            continue
        a = att.assessment
        log.info("%s take %d/%d seed=%d dur=%.2fs wer=%.2f f0=%.0f wps=%.2f rtf=%.2f bad=%.2f %s",
                 line["id"], k + 1, args.attempts, seed, a.dur, a.wer, a.metrics["f0_med"], a.metrics["wps"], take.rtf, a.badness,
                 "ACCEPT" if a.ok else "RETRY: " + "; ".join(a.problems))
        keep_raw = best is None or a.badness < best.assessment.badness
        if keep_raw:
            if best is not None:
                best.path.unlink(missing_ok=True)
            best = att
            takes_dir.mkdir(parents=True, exist_ok=True)
            try:
                import soundfile as sf

                sf.write(takes_dir / f"{line['id']}.flac", take.wav, sr)
            except Exception:
                log.warning("%s: could not store the raw take", line["id"])
        else:
            tmp.unlink(missing_ok=True)
        if a.ok:
            break
    return best, used, route


def remaster_line(line: dict, voice: dict, st: stt.Stt, args, out_dir: Path, takes_dir: Path):
    """Redo trim, loudness and encoding from the stored raw take, no TTS."""
    import soundfile as sf

    raw, sr = sf.read(takes_dir / f"{line['id']}.flac", dtype="float32")
    tmp = out_dir / f".{line['id']}.remaster.mp3"
    att = finish_take(raw, sr, line, voice, st, tmp, args.kbps, False, args.accept_wer, 0, 0, 0.0, 0)
    return att


def adopt_line(line: dict, voice: dict, st: stt.Stt, args, out_dir: Path):
    """An MP3 exists but the manifest has no entry (crash between the two writes). Verify it, no TTS."""
    path = out_dir / f"{line['id']}.mp3"
    sr = 24000
    decoded = audio.decode_audio(path, sr)
    tr = st.transcribe(path)
    sc = stt.score(line["text"], tr.text)
    a = qa.assess(decoded, sr, line["text"], voice, sc, False, args.accept_wer)
    return Attempt(0, 0, path, decoded, tr, sc, a, 0.0, 0.0, 0)


# --------------------------------------------------------------------------- bookkeeping


def classify(lines: list, manifest: dict, state: dict, voices: dict, out_dir: Path, args) -> dict:
    """Sort every wanted line into: todo (render), adopt, remaster, stale, ok, unknown_voice."""
    buckets = {"render": [], "adopt": [], "remaster": [], "ok": [], "unknown_voice": []}
    redo_ids = set(args.redo_id or [])
    for line in lines:
        v = voices.get(line["voice"])
        if v is None:
            buckets["unknown_voice"].append(line)
            continue
        if args.only and line["voice"] not in args.only:
            continue
        entry = manifest["lines"].get(line["id"])
        path = out_dir / f"{line['id']}.mp3"
        st_ = state["lines"].get(line["id"], {})
        valid = entry is not None and mf.mp3_looks_valid(str(path), entry.get("dur"))
        redo = (line["id"] in redo_ids or line["voice"] in (args.redo_voice or [])
                or (args.redo_wer is not None and entry is not None and entry.get("wer", 0) > args.redo_wer))
        if redo:
            buckets["render"].append(line)
        elif not valid:
            if entry is None and mf.mp3_looks_valid(str(path)):
                buckets["adopt"].append(line)
            else:
                buckets["render"].append(line)
        elif not args.keep_stale and st_.get("sig") and st_["sig"] != voice_sig(line["voice"], v):
            buckets["render"].append(line)
        elif not args.keep_stale and st_.get("msig") and st_["msig"] != master_sig(v, args.kbps) \
                and (Path(args.takes) / f"{line['id']}.flac").exists():
            buckets["remaster"].append(line)
        else:
            buckets["ok"].append(line)
    return buckets


def sync_voices(manifest: dict, voices: dict) -> None:
    manifest["voices"] = {vid: {"name": v["name"]} for vid, v in voices.items()}


def commit_entry(args, manifest: dict, state: dict, line: dict, entry: dict, st_entry: dict) -> None:
    manifest["lines"][line["id"]] = entry
    state["lines"][line["id"]] = st_entry
    mf.save_manifest(args.manifest, manifest)
    mf.save_state(args.state, state)


def audit(manifest: dict, voices: dict, out_dir: Path) -> None:
    rows = manifest["lines"]
    print(f"{len(rows)} lines in manifest, {sum(e['dur'] for e in rows.values()):.0f}s of audio")
    per = {}
    for lid, e in rows.items():
        per.setdefault(e["voice"], []).append((lid, e))
    print(f"{'voice':10s} {'n':>3s} {'mean WER':>8s} {'max WER':>7s} {'mean dur':>8s} {'wps':>5s}")
    for vid, items in per.items():
        w = [e["wer"] for _, e in items]
        wps = [len(e["text"].split()) / max(e["dur"], 0.1) for _, e in items]
        print(f"{vid:10s} {len(items):3d} {sum(w)/len(w):8.3f} {max(w):7.2f} {sum(e['dur'] for _, e in items)/len(items):8.2f} {sum(wps)/len(wps):5.2f}")
    print("\nsuspicious:")
    n = 0
    for lid, e in sorted(rows.items()):
        words = len(e["text"].split())
        probs = []
        if e["wer"] > 0.1:
            probs.append(f"wer {e['wer']}")
        if e["dur"] > 0 and words >= 3 and not (0.12 <= e["dur"] / words <= 1.6):
            probs.append(f"{e['dur'] / words:.2f}s per word")
        if not mf.mp3_looks_valid(str(out_dir / e["file"]), e["dur"]):
            probs.append("file missing or broken")
        if "words" in e and len(e["words"]) != words:
            probs.append("words count != text")
        if probs:
            n += 1
            print(f"  {lid}: {', '.join(probs)} | {e['text'][:60]!r}")
    print(f"{n} suspicious")


# --------------------------------------------------------------------------- main


def setup_logging(path: str) -> None:
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%H:%M:%S")
    log.setLevel(logging.INFO)
    fh = logging.FileHandler(path, encoding="utf-8")
    fh.setFormatter(fmt)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    log.addHandler(fh)
    log.addHandler(sh)


def on_signal(signum, _frame):
    global STOP
    STOP = True
    log.warning("signal %d: finishing the current line, then stopping", signum)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lines", nargs="+", help="lines files, merged by id (default: lines.json if it has lines, else lines.seed.json)")
    ap.add_argument("--out", default=str(REPO / "public" / "audio" / "vo"), help="where the MP3s go")
    ap.add_argument("--manifest", default=None, help="default: <out>/manifest.json")
    ap.add_argument("--voices", default=str(HERE / "voices.json"))
    ap.add_argument("--state", default=str(HERE / "render-state.json"), help="how each line was rendered (seed, attempts, signatures)")
    ap.add_argument("--takes", default=str(HERE / "scratch" / "takes"), help="raw takes, kept for remastering (local only)")
    ap.add_argument("--log", default=str(HERE / "generate.log"))
    ap.add_argument("--only", action="append", help="only this voice id (repeatable)")
    ap.add_argument("--limit", type=int, default=None, help="render at most N lines this run")
    ap.add_argument("--attempts", type=int, default=4, help="takes per line, at most 4 by the contract")
    ap.add_argument("--accept-wer", type=float, default=qa.ACCEPT_WER)
    ap.add_argument("--kbps", type=int, default=32, help="MP3 bitrate, 24 to 64")
    ap.add_argument("--redo-id", action="append", help="re-render this line id")
    ap.add_argument("--redo-voice", action="append", help="re-render every line of this voice")
    ap.add_argument("--redo-wer", type=float, default=None, help="re-render lines whose manifest WER is above this")
    ap.add_argument("--keep-stale", action="store_true", help="do not re-render lines whose voice changed since they were rendered")
    ap.add_argument("--dry-run", action="store_true", help="list what would be rendered, load no model")
    ap.add_argument("--audit", action="store_true", help="print per-voice stats and suspicious lines from the manifest, then exit")
    args = ap.parse_args()
    args.attempts = max(1, min(4, args.attempts))
    args.kbps = max(16, min(64, args.kbps))
    args.manifest = args.manifest or os.path.join(args.out, "manifest.json")
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    setup_logging(args.log)

    voices = json.loads(Path(args.voices).read_text(encoding="utf-8"))
    manifest = mf.load_manifest(args.manifest)
    state = mf.load_state(args.state)

    if args.audit:
        audit(manifest, voices, out_dir)
        return 0

    paths = [Path(p) for p in (args.lines or default_lines_paths())]
    lines = load_lines(paths)
    buckets = classify(lines, manifest, state, voices, out_dir, args)
    for line in buckets["unknown_voice"]:
        log.error("%s: voice %r is not in %s, skipping", line["id"], line["voice"], args.voices)
    todo = buckets["render"]
    if args.limit is not None:
        todo = todo[: args.limit]
    log.info("plan: %d lines wanted, %d ok, %d to render%s, %d to adopt, %d to remaster, %d unknown voice",
             len(lines), len(buckets["ok"]), len(buckets["render"]), f" (limit {args.limit})" if args.limit is not None else "",
             len(buckets["adopt"]), len(buckets["remaster"]), len(buckets["unknown_voice"]))
    if args.dry_run:
        for line in todo:
            print(f"render {line['id']} {line['voice']}: {line['text'][:70]!r}")
        for line in buckets["adopt"]:
            print(f"adopt  {line['id']}")
        for line in buckets["remaster"]:
            print(f"remast {line['id']}")
        return 0

    with mf.run_lock(args.manifest):
        signal.signal(signal.SIGTERM, on_signal)
        signal.signal(signal.SIGINT, on_signal)
        sync_voices(manifest, voices)
        mf.save_manifest(args.manifest, manifest)
        if not (todo or buckets["adopt"] or buckets["remaster"]):
            log.info("nothing to do")
            return 0

        st = stt.Stt()
        eng = None
        sr = 24000
        done = adopted = remastered = failed = 0
        wers = []
        weak = []
        t_start = time.time()

        for line in buckets["adopt"]:
            if STOP:
                break
            voice = voices[line["voice"]]
            try:
                att = adopt_line(line, voice, st, args, out_dir)
                if att.assessment.wer <= args.accept_wer:
                    commit_entry(args, manifest, state, line, entry_from(line, att, sr),
                                 state_from(line, voice, att, 0, args.kbps, voice.get("route", "design"), "adopted orphan mp3"))
                    adopted += 1
                    log.info("%s adopted existing mp3 wer=%.2f", line["id"], att.assessment.wer)
                else:
                    todo.append(line)
            except Exception:
                log.error("%s adopt failed\n%s", line["id"], traceback.format_exc())
                todo.append(line)

        for line in buckets["remaster"]:
            if STOP:
                break
            voice = voices[line["voice"]]
            try:
                att = remaster_line(line, voice, st, args, out_dir, Path(args.takes))
                final = out_dir / f"{line['id']}.mp3"
                os.replace(att.path, final)
                commit_entry(args, manifest, state, line, entry_from(line, att, sr),
                             {**state["lines"].get(line["id"], {}), "msig": master_sig(voice, args.kbps), "ts": int(time.time())})
                remastered += 1
                log.info("%s remastered wer=%.2f lufs=%.1f", line["id"], att.assessment.wer, att.assessment.metrics["lufs"])
            except Exception:
                log.error("%s remaster failed\n%s", line["id"], traceback.format_exc())
                failed += 1

        for i, line in enumerate(todo, 1):
            if STOP:
                break
            voice = voices[line["voice"]]
            if eng is None:
                from ttslib import tts

                eng = tts.Engine(need_base=any(v.get("route") == "clone" for v in voices.values()))
                log.info("engine ready in %.1fs", eng.load_s)
            t_line = time.time()
            try:
                best, used, route = render_line(line, voice, eng, st, args, out_dir, Path(args.takes))
                if best is None:
                    raise RuntimeError("no usable take in %d attempts" % args.attempts)
                final = out_dir / f"{line['id']}.mp3"
                os.replace(best.path, final)
                commit_entry(args, manifest, state, line, entry_from(line, best, sr), state_from(line, voice, best, used, args.kbps, route))
                done += 1
                wers.append(best.assessment.wer)
                if not best.assessment.ok:
                    weak.append((line["id"], best.assessment.badness, best.assessment.problems))
                    log.warning("%s kept a weak take (bad=%.2f): %s", line["id"], best.assessment.badness, "; ".join(best.assessment.problems))
            except Exception:
                failed += 1
                log.error("%s FAILED, moving on\n%s", line["id"], traceback.format_exc())
            el = time.time() - t_start
            n_done = done + failed
            eta = el / max(n_done, 1) * (len(todo) - i)
            log.info("progress %d/%d lines (%d failed) %.0fs elapsed, line took %.1fs, ETA %.0fs, peak mem %.1f GB",
                     i, len(todo), failed, el, time.time() - t_line, eta, eng.peak_gb() if eng else 0.0)

        mean_wer = sum(wers) / len(wers) if wers else 0.0
        log.info("DONE rendered=%d adopted=%d remastered=%d failed=%d weak=%d mean_wer=%.3f in %.0fs%s",
                 done, adopted, remastered, failed, len(weak), mean_wer, time.time() - t_start, " (stopped early)" if STOP else "")
        for lid, bad, probs in weak:
            log.info("  weak %s bad=%.2f %s", lid, bad, "; ".join(probs))
        all_w = [e["wer"] for e in manifest["lines"].values()]
        log.info("manifest now has %d lines, mean wer %.3f", len(all_w), sum(all_w) / max(len(all_w), 1))
    return 1 if failed and not done else 0


if __name__ == "__main__":
    sys.exit(main())
