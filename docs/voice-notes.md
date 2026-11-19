# Voice notes

Why the voice pipeline works the way it does, with the numbers behind each decision. How to run it is in
[`tools/tts/README.md`](../tools/tts/README.md); the binding file and manifest format is
[`voice-contract.md`](voice-contract.md).

Everything below was measured on an Apple M1 Max (64 GB) with nothing played aloud: speech to text
(`parakeet-tdt-0.6b-v2`) and numbers (parselmouth pitch, spectral centroid, BS.1770 loudness).

## The model

`Qwen3-TTS-12Hz-1.7B-VoiceDesign` (bf16, `mlx-community` conversion) through `mlx-audio` 0.6.6 on MLX 0.32.4,
24 kHz mono output, 12.5 codec tokens per second. You describe a voice in words and give the line as text;
there is no stored speaker, so **every call invents a speaker**. Everything in the pipeline exists to turn
that into a stable cast.

| | measured |
| --- | --- |
| speed | 0.50 to 0.65 compute seconds per audio second on a quiet machine (0.9 and worse when other jobs share the GPU) |
| memory | 4.6 GB after load, 6 to 9 GB peak while generating |
| model load | 3 to 11 s |
| accuracy | mean WER 0.02 on the spike takes; one looped take in 114 (capped by the token limit and retried) |

## Route: VoiceDesign direct, with a selection gate

Two routes were compared on the same 6 voices:

1. **VoiceDesign direct** for every line: identity comes from the description, the per-line `delivery`
   note is honoured, speech pace is natural.
2. **Clone**: render one good VoiceDesign take per voice, then clone it with the Base 1.7B model for every
   line. More consistent pitch and tone (pitch CV 10% against 14%), but 20 to 65% faster speech than the
   reference, no `delivery` control (Base takes no instruction), and about 25% more compute.

VoiceDesign direct won because the clone route loses delivery and pace, which are the jokes. The drift is
handled by choosing between takes instead. Measured on the final cast, the same line rendered with different
seeds differs by about **3 semitones** of median pitch (standard deviation), while different lines of one
voice differ by 0.7 to 2.8 semitones. So the spread is mostly sampling luck, and picking among up to 4 takes
removes most of it. Lowering the temperature did not shrink it reliably (pitch CV 14 to 24% at temperature
0.25, 0.4, 0.55 and 0.7 on the same voices), so every voice uses temperature 0.7, top_k 40.

### The gate (`ttslib/qa.py`)

Each voice has an intent `target` in `voices.json`: median pitch band, speaking rate band, optional pitch
spread band. A take is scored by one number, `badness`:

| rule | badness |
| --- | --- |
| WER above 0.25, hit the token cap, clipping, rushed (under 0.12 s per word), dragged (over 2.2 s per word) | 100 each (hard failure) |
| a pause longer than 2.4 s | 1.5 |
| words the model improvised (heard but not in the text) | 0.3 |
| median pitch outside the band (more than 0.5 semitone) | 1 per semitone outside |
| speaking rate outside the band (more than 10%) | 6 per unit of relative distance |
| pitch spread outside its band | 0.5 per semitone |
| distance from the middle of the pitch band | 0.1 per semitone |
| distance from the middle of the pace band | 0.8 per natural-log unit |
| WER | 5 per unit |

Under 1 is accepted; under 0.35 is "excellent" and stops the retry loop. Otherwise the loop samples up to
4 takes and keeps the lowest score. Lines with a `delivery` note get 2 semitones and 20% extra slack because
"whispering" or "fired up" legitimately moves pitch and pace. A line that never passes keeps its best take
and is listed as weak, so the game always has audio.

### Measuring pitch

Both trackers (Praat autocorrelation and cross-correlation, pyin) agree, but only with a ceiling high enough
for the voice. A child or cartoon voice tracked with a 400 Hz ceiling reported 226 to 291 Hz; the harmonics in
the loud frames sit 450 to 590 Hz apart, so the real pitch was about 490 Hz. `ttslib/audio.py` tracks with a
wide range first, then narrows it around the voice's own quartiles.

## Wording that matters

The description is taken literally, so some adjectives backfire:

- `high pitched`, `squeaky`, `energetic`, `excited`, `shouting` push pitch far up. Round 1 gave an excited
  "announcer" 430 Hz, an "intern" 372 to 459 Hz, a "ten year old boy" 494 Hz.
- Name the **register** instead: `bass`, `baritone`, `tenor`, `mezzo-soprano`, `low-pitched`. Changing
  "energetic confident man" to "deep, confident baritone" moved the same voice from 203 Hz to 137 Hz.
- `slowly`, `long pauses` work for pace; `fast` barely does (2.4 to 2.9 words/s for voices described as
  fast, against 1.8 to 2.2 for slow ones). Stronger cues (`rapid-fire`, `words tumbling out`) help a little.
- A real-sounding child needs `slightly husky, low for his age`; plain `ten year old boy` is a toddler pitch.
- "Epic and solemn" or "velvety baritone announcing everything as the most important event in history"
  gives a stable low announcer; "thrilled and bombastic" gives a bimodal one (140 Hz or 230 Hz).

## Known failure modes

| symptom | cause | handled by |
| --- | --- | --- |
| a spoken "Ugh.", "Uh", "Hmm." before the line (tired and growly voices) | the model acts the description | extra-word penalty, retry |
| looped or held note running to the token cap | sampling at low temperature | token cap `60 + 16 x words`, retry |
| "Vibey" heard as "Vibe", `doStuff` as "do stuff" | speech to text, not the model | normalizer treats camelCase splits as matches |
| one take in a voice jumps an octave (monotone robot at 205 Hz instead of 100) | sampling | pitch band, retry |
| long silence inside the line | "weary sighs" in a description | max gap rule, softer wording |

## Loudness and encoding

Silence is trimmed (adaptive gate, 50 ms lead and 140 ms tail kept, short fades). Integrated loudness is
matched to -19 LUFS plus the voice's `trim` (whisperers negative, loud voices positive), a look-ahead limiter
holds peaks at -2 dBFS, and the result is encoded mono 24 kHz MP3 at 32 kbps CBR with a deterministic encoder
(no metadata, Xing header kept, so the duration is exact). **All metrics are taken from the decoded MP3**, the
file the game loads; speech to text runs on it too.
