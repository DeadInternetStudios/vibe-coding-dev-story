"""Qwen3-TTS-12Hz-1.7B-VoiceDesign on MLX (mlx-audio), plus the optional Base clone path.

Identity always comes from VoiceDesign. The clone path only exists to keep one designed
voice one voice: it takes a VoiceDesign take as the reference clip.

Nothing here plays audio. A take is a numpy array.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np

VD_REPO = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"
BASE_REPO = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
SAMPLE_RATE = 24000
TOKENS_PER_SEC = 12.5  # the 12Hz codec

SAMPLING_KEYS = ("temperature", "top_k", "top_p", "repetition_penalty")


def max_tokens_for(text: str, per_word: int = 16, base: int = 60, cap: int = 1500) -> int:
    """Hard stop for one take, so a model that never emits EOS cannot run for minutes.

    16 tokens per word is 1.3 s per word, far slower than any voice here talks. Hitting the cap
    means the take rambled or looped, and it is reported as truncated.
    """
    return int(min(cap, base + per_word * max(1, len(text.split()))))


@dataclass
class Take:
    wav: np.ndarray
    sr: int
    compute_s: float
    tokens: int
    max_tokens: int
    peak_gb: float

    @property
    def dur(self) -> float:
        return len(self.wav) / self.sr

    @property
    def rtf(self) -> float:
        """Seconds of compute per second of audio."""
        return self.compute_s / max(self.dur, 1e-6)

    @property
    def hit_cap(self) -> bool:
        return self.tokens >= self.max_tokens - 1


def compose_instruct(description: str, delivery: str | None) -> str:
    """The VoiceDesign `instruct`: who the voice is, then how this one line is delivered."""
    if not delivery:
        return description
    return f"{description} For this line, the delivery is: {delivery}."


class Engine:
    def __init__(self, need_base: bool = False, vd_repo: str = VD_REPO, base_repo: str = BASE_REPO):
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model

        self.mx = mx
        t = time.time()
        self.vd = load_model(vd_repo)
        self.load_s = time.time() - t
        self.base = load_model(base_repo) if need_base else None
        self.sr = self.vd.sample_rate
        assert self.sr == SAMPLE_RATE

    def peak_gb(self) -> float:
        return self.mx.get_peak_memory() / 1e9

    def design(self, instruct: str, text: str, seed: int, max_tokens: int | None = None, **sampling) -> Take | None:
        mx = self.mx
        mx.random.seed(int(seed) & 0x7FFFFFFF)
        mt = max_tokens or max_tokens_for(text)
        kw = {k: v for k, v in sampling.items() if k in SAMPLING_KEYS and v is not None}
        t = time.time()
        res = list(self.vd.generate_voice_design(text=text, instruct=instruct, language="English", max_tokens=mt, **kw))
        el = time.time() - t
        if not res:
            return None
        r = res[0]
        return Take(np.array(r.audio, dtype=np.float32), self.sr, el, int(r.token_count), mt, float(r.peak_memory_usage))

    def clone(self, ref_wav: np.ndarray, ref_text: str, text: str, seed: int, max_tokens: int | None = None, **sampling) -> Take | None:
        assert self.base is not None, "Engine(need_base=True) to clone"
        mx = self.mx
        mx.random.seed(int(seed) & 0x7FFFFFFF)
        mt = max_tokens or max_tokens_for(text)
        kw = {k: v for k, v in sampling.items() if k in SAMPLING_KEYS and v is not None}
        t = time.time()
        res = list(self.base.generate(text=text, ref_audio=mx.array(ref_wav), ref_text=ref_text, lang_code="english", max_tokens=mt, **kw))
        el = time.time() - t
        if not res:
            return None
        r = res[0]
        return Take(np.array(r.audio, dtype=np.float32), self.sr, el, int(r.token_count), mt, float(r.peak_memory_usage))

    def speaker_embedding(self, wav: np.ndarray) -> np.ndarray:
        """x-vector from the Base model's speaker encoder, unit length."""
        assert self.base is not None
        e = self.base.extract_speaker_embedding(self.mx.array(wav))
        e = np.array(e, dtype=np.float32).reshape(-1)
        return e / (np.linalg.norm(e) + 1e-9)
