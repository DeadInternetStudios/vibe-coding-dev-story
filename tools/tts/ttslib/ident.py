"""Does a take still sound like its own voice? Speaker embeddings from the Base model's encoder.

VoiceDesign invents a new speaker on every call, so the pitch and pace bands in qa.py catch only part of
the drift: a take can sit inside its band and still sound like another character. `castcheck.py --save`
writes ident.json from the rendered cast: the cast-wide mean embedding and, per voice, its centroid plus the
mean and spread of its lines' cosine to that centroid. generate.py then scores every take against it:

* how typical the take is for its own voice (a z-score of its cosine to the centroid), and
* whether another voice's centroid is nearer than its own ("sounds like someone else").

Embeddings are centred on the cast mean before comparing, because raw cosines between speakers are all high
and say little.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

MIN_LINES = 5  # a voice needs this many rendered lines before it gets a centroid
MIN_SD = 0.05  # floor for the spread, so a very tight voice does not make every take look like an outlier
SLACK_Z = 0.5  # takes this many spreads below the voice's typical cosine cost nothing
Z_PENALTY = 0.25  # badness per spread beyond that
MISFIT_MARGIN = 0.05  # another voice's centroid this much nearer than the take's own: it sounds like someone else
MISFIT_PENALTY = 1.0  # as bad as missing the pitch band by a semitone: enough to ask for another take


def embed(base, wav: np.ndarray) -> np.ndarray:
    """Unit-length speaker embedding of mono 24 kHz float32 audio."""
    import mlx.core as mx

    e = np.array(base.extract_speaker_embedding(mx.array(wav)), dtype=np.float32).reshape(-1)
    return e / (np.linalg.norm(e) + 1e-9)


def centre(e: np.ndarray, mean: np.ndarray) -> np.ndarray:
    c = e - mean
    return c / (np.linalg.norm(c) + 1e-9)


def build(embeddings: np.ndarray, owners: list) -> dict:
    """The ident.json content from raw unit embeddings of rendered lines and the voice of each line."""
    mean = embeddings.mean(axis=0)
    centred = np.stack([centre(e, mean) for e in embeddings])
    voices = {}
    for v in sorted(set(owners)):
        idx = [i for i, o in enumerate(owners) if o == v]
        if len(idx) < MIN_LINES:
            continue
        c = centred[idx].mean(axis=0)
        c /= np.linalg.norm(c) + 1e-9
        own = centred[idx] @ c
        voices[v] = {"n": len(idx), "own_mean": round(float(own.mean()), 4),
                     "own_sd": round(float(max(own.std(), MIN_SD)), 4),
                     "centroid": [round(float(x), 4) for x in c]}
    return {"version": 1, "mean": [round(float(x), 4) for x in mean], "voices": voices}


def penalty(s: dict | None) -> tuple:
    """(badness to add, problem text or None) for one take's identity score."""
    if s is None:
        return 0.0, None
    bad = Z_PENALTY * max(0.0, -s["z"] - SLACK_Z)
    note = None
    if s["other"] - s["own"] > MISFIT_MARGIN:
        bad += MISFIT_PENALTY
        note = "sounds more like %s than itself (cosine %.2f against %.2f)" % (s["other_voice"], s["other"], s["own"])
    return bad, note


class Identity:
    def __init__(self, data: dict):
        self.mean = np.array(data["mean"], dtype=np.float32)
        self.voices = data["voices"]
        self.ids = list(self.voices)
        self.cent = np.stack([np.array(self.voices[v]["centroid"], dtype=np.float32) for v in self.ids])
        self._base = None

    @classmethod
    def load(cls, path) -> "Identity":
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def _model(self):
        if self._base is None:
            from mlx_audio.tts.utils import load_model

            from . import tts

            self._base = load_model(tts.BASE_REPO)
        return self._base

    def score_embedding(self, voice: str, raw_embedding: np.ndarray) -> dict | None:
        """{own, other, other_voice, z, margin} for one take; None when the voice has no centroid yet."""
        if voice not in self.voices:
            return None
        sims = self.cent @ centre(raw_embedding, self.mean)
        i = self.ids.index(voice)
        own = float(sims[i])
        rest = sims.copy()
        rest[i] = -9.0
        j = int(rest.argmax())
        v = self.voices[voice]
        return {"own": own, "other": float(sims[j]), "other_voice": self.ids[j],
                "z": (own - v["own_mean"]) / v["own_sd"], "margin": own - float(sims[j])}

    def score(self, voice: str, wav: np.ndarray) -> dict | None:
        if voice not in self.voices:
            return None
        return self.score_embedding(voice, embed(self._model(), wav))
