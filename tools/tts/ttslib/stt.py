"""Speech-to-text check: transcribe the file the game will load, score it, time its words.

parakeet-mlx (NVIDIA Parakeet TDT 0.6B v2 on MLX) gives text plus per-token timestamps.
We turn those into:
  - a word error rate against the source text (0 is perfect), with a normalizer that
    forgives how a recognizer writes numbers, hyphens and compounds ("J-I-F" vs "jif",
    "doStuff" vs "do stuff", "ten X" vs "10x");
  - one [start, end] per whitespace separated word of the source text, as the contract wants.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

STT_MODEL = "mlx-community/parakeet-tdt-0.6b-v2"


@dataclass
class Transcript:
    text: str
    words: list  # [(word, start, end)]
    seconds: float = 0.0


class Stt:
    """Loads parakeet once, transcribes files."""

    def __init__(self, model_id: str = STT_MODEL):
        from parakeet_mlx import from_pretrained

        self.model_id = model_id
        self.model = from_pretrained(model_id)

    def transcribe(self, path) -> Transcript:
        import time

        t = time.time()
        res = self.model.transcribe(str(path))
        words = []
        for tok in res.tokens:
            piece = tok.text
            if piece.startswith(" ") or not words:
                words.append([piece.strip(), float(tok.start), float(tok.end)])
            else:
                words[-1][0] += piece
                words[-1][2] = float(tok.end)
        words = [(w, s, e) for w, s, e in words if w]
        return Transcript(text=res.text, words=words, seconds=time.time() - t)


# --------------------------------------------------------------------------- normalizing


def _spell_number(m: re.Match) -> str:
    from num2words import num2words

    raw = m.group(0).replace(",", "")
    try:
        if "." in raw:
            return " " + num2words(float(raw)).replace("-", " ").replace(",", "") + " "
        return " " + num2words(int(raw)).replace("-", " ").replace(",", "") + " "
    except Exception:
        return " " + raw + " "


_SPELL = {"ok": "okay", "mr": "mister", "dr": "doctor", "vs": "versus"}


def split_camel(word: str) -> str:
    """doStuff -> do Stuff (so a recognizer writing 'do stuff' still matches)."""
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", word)


def normalize_word(word: str) -> list:
    """One whitespace separated source (or recognized) word -> list of comparable tokens."""
    w = split_camel(word)
    w = w.replace("\u2019", "'").replace("&", " and ")
    w = re.sub(r"(?<=\d)(?=[xX]\b)", " ", w)  # 10x -> 10 x
    w = re.sub(r"\d{1,3}(?:,\d{3})+", lambda m: m.group(0).replace(",", ""), w)
    w = re.sub(r"\d+(?:\.\d+)?", _spell_number, w)
    w = w.lower()
    w = re.sub(r"[\u2010-\u2015/\-_]", " ", w)  # hyphens, dashes, slashes split a word
    w = re.sub(r"[^a-z' ]", " ", w)
    out = []
    for t in w.split():
        t = t.strip("'")
        if t:
            out.append(_SPELL.get(t, t))
    return out


def normalize_text(text: str) -> list:
    out = []
    for w in text.split():
        out.extend(normalize_word(w))
    return out


# --------------------------------------------------------------------------- alignment


def _align(ref: list, hyp: list) -> list:
    """Levenshtein alignment. Returns ops: ('ok'|'sub'|'del'|'ins', ref_idx|None, hyp_idx|None)."""
    n, m = len(ref), len(hyp)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        d[i][0] = i
    for j in range(1, m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            d[i][j] = min(d[i - 1][j - 1] + cost, d[i - 1][j] + 1, d[i][j - 1] + 1)
    ops = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            ops.append(("ok" if ref[i - 1] == hyp[j - 1] else "sub", i - 1, j - 1))
            i, j = i - 1, j - 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            ops.append(("del", i - 1, None))
            i -= 1
        else:
            ops.append(("ins", None, j - 1))
            j -= 1
    ops.reverse()
    return ops


@dataclass
class Score:
    wer: float
    errors: int
    ref_len: int
    missing: int = 0  # reference words the recognizer never heard (truncation, mumbling)
    extra: int = 0  # words heard that are not in the text (rambling, hallucination)
    hyp_text: str = ""
    spans: list = field(default_factory=list)  # [(ref_idx list, hyp_idx list)] error regions


def _error_spans(ops: list) -> list:
    """Group consecutive non-ok ops into (ref indices, hyp indices) regions."""
    spans, cur_r, cur_h = [], [], []
    for kind, i, j in ops:
        if kind == "ok":
            if cur_r or cur_h:
                spans.append((cur_r, cur_h))
                cur_r, cur_h = [], []
            continue
        if i is not None:
            cur_r.append(i)
        if j is not None:
            cur_h.append(j)
    if cur_r or cur_h:
        spans.append((cur_r, cur_h))
    return spans


def score(ref_text: str, hyp_text: str) -> Score:
    ref = normalize_text(ref_text)
    hyp = normalize_text(hyp_text)
    if not ref:
        return Score(0.0 if not hyp else 1.0, len(hyp), 0, hyp_text=hyp_text)
    ops = _align(ref, hyp)
    errors = missing = extra = 0
    forgiven = []
    for r_idx, h_idx in _error_spans(ops):
        r_str = "".join(ref[i] for i in r_idx)
        h_str = "".join(hyp[j] for j in h_idx)
        if r_str == h_str:  # same letters, different word breaks: not an error
            forgiven.append((r_idx, h_idx))
            continue
        errors += max(len(r_idx), len(h_idx))
        missing += max(0, len(r_idx) - len(h_idx))
        extra += max(0, len(h_idx) - len(r_idx))
    return Score(
        wer=round(errors / len(ref), 4),
        errors=errors,
        ref_len=len(ref),
        missing=missing,
        extra=extra,
        hyp_text=hyp_text,
        spans=forgiven,
    )


# --------------------------------------------------------------------------- word timing


def word_times(text: str, hyp_words: list, dur: float) -> list:
    """[[start, end], ...] one per whitespace separated word of `text`.

    `hyp_words` is [(word, start, end)] from the recognizer. Source words are matched to
    recognized words through the same alignment the WER uses. Words the recognizer missed
    get an even share of the gap between their neighbours, so there is always one span
    per source word and the spans never go backwards.
    """
    src_words = text.split()
    ref_tok, ref_owner = [], []
    for wi, w in enumerate(src_words):
        for t in normalize_word(w):
            ref_tok.append(t)
            ref_owner.append(wi)
    hyp_tok, hyp_span = [], []
    for w, s, e in hyp_words:
        toks = normalize_word(w)
        for k, t in enumerate(toks):  # a recognized word that splits shares its span
            span = (s + (e - s) * k / len(toks), s + (e - s) * (k + 1) / len(toks))
            hyp_tok.append(t)
            hyp_span.append(span)

    n = len(ref_tok)
    spans = [None] * n
    if n and hyp_tok:
        ops = _align(ref_tok, hyp_tok)
        # one-to-one matches and substitutions
        for kind, i, j in ops:
            if kind in ("ok", "sub") and i is not None and j is not None:
                spans[i] = hyp_span[j]
        # error regions with identical letters: share the union span by letter count
        for r_idx, h_idx in _error_spans(ops):
            if r_idx and h_idx and "".join(ref_tok[i] for i in r_idx) == "".join(hyp_tok[j] for j in h_idx):
                s0, e0 = hyp_span[h_idx[0]][0], hyp_span[h_idx[-1]][1]
                total = sum(len(ref_tok[i]) for i in r_idx)
                acc = 0
                for i in r_idx:
                    a = s0 + (e0 - s0) * acc / total
                    acc += len(ref_tok[i])
                    spans[i] = (a, s0 + (e0 - s0) * acc / total)

    # fill holes by interpolating between assigned neighbours
    i = 0
    while i < n:
        if spans[i] is not None:
            i += 1
            continue
        j = i
        while j < n and spans[j] is None:
            j += 1
        left = spans[i - 1][1] if i > 0 else 0.0
        right = spans[j][0] if j < n else dur
        right = max(right, left)
        k = j - i
        for q in range(k):
            spans[i + q] = (left + (right - left) * q / k, left + (right - left) * (q + 1) / k)
        i = j

    # collapse tokens back to source words
    out = []
    for wi in range(len(src_words)):
        mine = [spans[t] for t in range(n) if ref_owner[t] == wi]
        if mine:
            out.append([min(s for s, _ in mine), max(e for _, e in mine)])
        else:  # a word with no letters, like a lone dash: zero length at the previous end
            prev = out[-1][1] if out else 0.0
            out.append([prev, prev])

    # clean: clamp, monotonic, 2 decimals
    cleaned = []
    prev_end = 0.0
    for s, e in out:
        s = min(max(s, prev_end), dur)
        e = min(max(e, s), dur)
        cleaned.append([round(s, 2), round(e, 2)])
        prev_end = e
    return cleaned
