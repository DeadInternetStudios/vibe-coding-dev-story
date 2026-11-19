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

### Bands come from the voice's own lines

The first bands came from five neutral probe sentences per voice. They were too low for the animated voices,
because hype lines sit higher than calm ones (median pitch on probe sentences against the voice's own lines, Hz):
bro 111 against 210, karen 331 against 417, jenny 335 against 418, clod 174 against 208, chad 139 against 162.
`calibrate.py --log generate.log` therefore builds the bands from the **first take of every real line** (later
takes exist only because an earlier one missed, so they would bias the numbers) and centres each band on the
**densest cluster** of pitches, not the median. A voice with two registers has its median in the empty gap: the
announcer's first takes were 74 to 96 Hz (deep) and 119 to 196 Hz (shouting), median 116 Hz, densest cluster
83 Hz. The cast seed says "huge, bombastic, deep", so the deep register is his, and lines that come out shouting
are retaken until one comes out deep.

### Two things the pitch number hides

- **Adult women came out at about 400 Hz.** Jenny and Karen measured 417 and 417 Hz. Harmonic spacing in the
  loud frames agrees (355 to 430 Hz apart), so it is not a tracker octave error: "mezzo-soprano" and "medium-high
  pitch" make the model sing. A natural adult woman speaks around 200 to 250 Hz. Karen's description now says
  "normal adult pitch, a low mezzo alto, not high-pitched", which gave 300 Hz and is separated from Jenny by
  almost six semitones. Jenny is left at about 400 Hz (an anxious intern squeaking is the joke); lowering her
  to 350 Hz with `alto` and `normal young-woman pitch` is possible but did not change her character enough to
  matter.
- **Pitch does not make a voice recognisable.** On 157 lines, 87% were nearest to their own voice's centroid in
  speaker-embedding space, and the closest pairs were jenny and karen (centroid cosine 0.91), dave and narrator
  (0.85), linkedin and grandma (0.82), announcer and dave (0.73), bro and chad (0.74). Eight male voices sit
  between 78 and 115 Hz, so they differ by texture, pace and delivery. `castcheck.py` measures this and
  `ttslib/ident.py` uses it inside the gate (below).

### The identity gate

`castcheck.py --save ident.json` embeds every rendered line with the Base 1.7B speaker encoder, subtracts the
cast-wide mean (raw cosines between speakers are all high and say little), and stores each voice's centroid and
how tightly its lines sit around it. `generate.py` then adds to a take's badness: 0.25 per spread below the
voice's typical cosine beyond half a spread, and 1.0 when another voice's centroid is nearer than its own by
more than 0.05 ("sounds like someone else"). Example from the first test, three Dave takes in a row scored
"sounds more like doomer / vc / announcer" and the fourth, at z +2.7, was kept. The cost is more takes for voices
that drift (Dave, Chad, announcer).

## The cast in numbers

All 623 voiced lines of the content branch plus 61 demo lines are rendered: 684 MP3s, 67.9 minutes, 16.6 MB, mean
WER 0.005 (643 lines at exactly 0, worst 0.20, 13 above 0.10), 2.5 takes per line on average, median real-time
factor 0.73. Generated by `castreport.py --identity scratch/castcheck.json` right after the queue drained, before the
first polish round. "In band" is the share of lines inside the voice's calibrated pitch band, "weak" the lines the gate
still scores at 1.0 or worse, "identifiable" the share of lines whose speaker embedding is nearer to their own voice's
centroid than to any other voice's (cast average 75%).

| voice | lines | minutes | median Hz | words/s | mean WER | LUFS | in band | weak | identifiable | sounds like |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `clod` Clod | 71 | 6.9 | 202 | 2.66 | 0.001 | -19.5 | 96% | 3 | 75% | bright, quick, androgynous young adult with a customer-service smile |
| `chad` Chad | 37 | 3.5 | 132 | 2.32 | 0.008 | -19.1 | 78% | 5 | 70% | confident chest voice, motivational cadence, a little breathless |
| `dave` Senior Dev Dave | 89 | 8.8 | 86 | 2.38 | 0.006 | -20.6 | 100% | 2 | 57% | gravelly, tired, flat deadpan |
| `jenny` Jenny the Intern | 48 | 3.7 | 420 | 2.98 | 0.002 | -19.5 | 100% | 3 | 98% | young, breathy, anxious, up-talking, very fast |
| `automod` AutoModerator | 19 | 1.9 | 97 | 2.47 | 0.006 | -19.5 | 100% | 0 | 84% | flat robotic monotone, metronome pace |
| `announcer` The Announcer | 64 | 5.4 | 89 | 1.92 | 0.008 | -18.2 | 89% | 6 | 58% | deep, bombastic awards-show baritone |
| `narrator` The Narrator | 66 | 8.9 | 86 | 1.90 | 0.003 | -21.0 | 98% | 1 | 64% | elderly British, hushed nature-documentary whisper |
| `vc` The VC | 27 | 2.9 | 91 | 2.17 | 0.013 | -20.5 | 100% | 1 | 67% | smooth, low, unhurried, condescending, lazy vowels |
| `karen` Karen | 17 | 1.5 | 329 | 2.77 | 0.000 | -18.9 | 100% | 2 | 100% | harsh, nasal, indignant, escalating |
| `bro` Crypto Bro | 28 | 2.6 | 195 | 2.67 | 0.015 | -18.5 | 100% | 12 | 82% | loud hyped gym voice, fast, very wide pitch range |
| `pedant` Well Actually Guy | 35 | 2.9 | 170 | 2.53 | 0.009 | -19.5 | 63% | 17 | 80% | nasal, smug, fast |
| `doomer` The Doomer | 23 | 2.6 | 97 | 1.99 | 0.000 | -22.0 | 100% | 2 | 78% | monotone, whispery, defeated, long sighs |
| `linkedin` LinkedIn Influencer | 21 | 2.5 | 221 | 1.92 | 0.003 | -21.0 | 100% | 5 | 95% | breathy, over-emotional, slow dramatic pauses |
| `arch` I Use Arch Guy | 25 | 2.8 | 106 | 2.31 | 0.008 | -21.0 | 100% | 2 | 48% | nasal smug mumble, low energy |
| `ghost` Stack Overflow Ghost | 13 | 1.5 | 164 | 1.90 | 0.014 | -23.1 | 100% | 2 | 92% | hollow airy whisper, disappointed |
| `duck` Rubber Duck | 12 | 0.4 | 491 | 1.71 | 0.000 | -19.9 | 92% | 0 | 100% | tiny squeaky cartoon duck |
| `hacker` The Hacker | 19 | 2.0 | 78 | 1.97 | 0.000 | -20.7 | 100% | 1 | 95% | sub-bass villain growl, slow, menacing |
| `wholesome` Wholesome Redditor | 42 | 4.4 | 123 | 2.23 | 0.007 | -21.0 | 100% | 2 | 88% | warm soft baritone, a little teary |
| `grandma` Grandma | 16 | 1.8 | 223 | 2.17 | 0.000 | -20.1 | 100% | 0 | 88% | sweet elderly woman, slow, delighted, a quaver |
| `kid` Ten Year Old | 12 | 1.0 | 250 | 3.35 | 0.000 | -19.0 | 92% | 1 | 100% | ten year old, fast, thrilled, breathless |

Median pitch is Praat's, measured on the decoded MP3. The women's voices (Jenny 420 Hz, Karen 329 Hz, duck 491 Hz)
measure soprano high; the harmonic spacing in the spectrum confirms the numbers are real, the model's adult women
are simply high. Karen sits about 4 semitones below Jenny after her description was changed to "low mezzo alto, not
high-pitched", and the two are now told apart by the speaker encoder (98% and 100%).

## Weak spots

- **The deep men blur together.** Dave and the Narrator (centroids 0.92 cosine apart) and the Announcer and the Narrator
  (0.90) are the worst pairs: only 57%, 64% and 58% of their lines are nearest their own centroid. The nine voices
  between 78 and 123 Hz are told apart by pace (1.9 to 2.5 words/s), loudness (-18 to -22 LUFS) and texture, not by
  pitch. Arch (48%) and the VC (67%) are the least distinct. Identity-driven polish rounds retake the worst misfits; a description with a stronger signature
  (accent, age, a recurring mannerism) is the real fix, and it needs a human ear.
- **Wide-register voices.** Crypto Bro (84 to 378 Hz on first takes), Chad, Well Actually Guy and the Announcer's
  shouting mode swing by more than an octave between takes. They take the most retakes and kept the most weak lines
  (12 of 28 for Bro, 17 of 35 for the Pedant before polish).
- **Nobody listened.** Everything here is speech to text and numbers. A line can have WER 0 and still carry an odd
  breath, a sung word or a misplaced stress. The gallery page is there for a human pass.
- **Thin voices.** Duck (12 lines), Kid (12) and Ghost (13) have few lines, so their centroids are noisy; the duck says
  almost only "Quack".
- **Improvised words.** Tired and growly voices sometimes open with "Uh" or "Hmm". The extra-word penalty retakes them,
  but a few weak lines still carry one (`generate.py --audit` lists them).
- **Bands lag the voices.** They were recalibrated several times as the sample grew; lines rendered early were judged by
  earlier bands, which is why `--polish` also looks at pitch against the band as it is now.

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
