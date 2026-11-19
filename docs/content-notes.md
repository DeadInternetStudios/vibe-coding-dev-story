# Content notes

Written by the head writer for whoever wires the sim, the UI and the voice pipeline.
All comedy lives in `src/content/*.ts` as typed data. Nothing outside that folder was
changed except this file.

## What is in the box

| File | Export | Count |
|---|---|---|
| `kinds.ts` | `KINDS` | 16 (the 14 required plus `api` and `os` as late unlocks) |
| `niches.ts` | `NICHES` | 14 |
| `tools.ts` | `TOOLS` | 7 (`singularity` is the wild late unlock) |
| `traits.ts` | `TRAITS` | 26 |
| `staff.ts` | `ARCHETYPES`, names | 21 archetypes (15 normal plus duck, ghost, cat, hacker, tenx, agi), 80 first names, 60 last names, 26 company names |
| `channels.ts` | `CHANNELS` | 8 |
| `events.ts` | `EVENTS` | 92 (dev 40, month 28, launch 12, rare 12) |
| `threads.ts` | `VIGNETTES`, `OP_BODIES` | 120 vignettes, 24 OP bodies |
| `flavor.ts` | `LOADING`, `TIPS`, `HEADLINES`, `PAYDAY_ITEMS`, `COMMIT_MESSAGES`, `APP_REVIEWS`, `AMBIENT` | 63, 40, 65, 31, 43, 40, 47 voiced |
| `achievements.ts` | `ACHIEVEMENTS` | 49 (7 secret) |
| `endings.ts` | `ENDINGS` | 8 |
| `story.ts` | `INTRO`, `TUTORIAL`, `YEAR_END`, `FUNDING`, `FRIDAY`, `DEPLOY`, `MONTH_NARRATION` | 14, 14 keys, 3 shows, 2 outcomes, 3 branches, 7, 25 |

Voiced lines: 623 unique. Per voice: dave 85, clod 68, narrator 63, announcer 61,
jenny 45, wholesome 39, chad 34, pedant 32, bro 25, vc 24, arch 22, doomer 20,
linkedin 18, automod 16, hacker 16, karen 14, grandma 13, ghost 10, duck 9, kid 9.
All 90 seed lines from `tools/tts/cast.seed.md` are used word for word with the same
voice and delivery. Where one line plays in two places (a staff intro that is also in
`INTRO`, a duck "Quack." that is both an intro and an event reaction) it has the same id,
so it renders once.

`tools/tts/lines.json` was regenerated to check totals and then reverted. It is not part
of this change. Run `npm run vo:export` when the voice pipeline starts.

## Who is who

| Voice | Character | Reddit usernames |
|---|---|---|
| clod | the AI pair programmer, also the AGI intro | ClodFan99, ClodSaidItsFine |
| chad | the founder, which is you. The founder archetype is pinned to the name Chad | ShipItChad, VisionaryChad |
| dave | the senior developer, the thread's tired regular | SeniorDave_42, ThirtyYearsInProd, TabTabTab |
| jenny | the intern | InternOnDay1 |
| automod | AutoModerator, Dependabot, the QA gremlin | AutoModerator, Dependabot_Prod, QAGremlin |
| announcer | the Vibey Awards, endings, the 10x engineer intro | none |
| narrator | nature documentary, also the data scientist and the cat | InTheWildDevs |
| vc | investors and the product manager | SeriesAEnergy, AngelAtLarge, MoatMaven |
| karen | one star reviewers and the contractor | OneStarKaren, LetMeSpeakToManager, SeenItEverywhere |
| bro | the vibe coder, influencers, degens | TenXBro |
| pedant | the prompt engineer, lawyers who say actually | WellActuallyGuy, TechnicallyCorrect |
| doomer | the security nerd, general despair | DoomScrollDev, AIWillTakeMyJob |
| linkedin | the growth hacker, thought leaders | ThrilledAndHumbled |
| arch | designers and Arch users | ArchBTW_2012, BtwIUseArch, ViewSourceGuy, ZoomedTo800, PixelPushPete |
| hacker | devops, the hooded visitor | RootedYourBox, ImIn_, TotallyNotAHacker |
| wholesome | community manager, the kindest user alive | WholesomeWendy, FellowMaker, FirstOnTheScene |
| grandma | the friend who "helps", nana threads | GrandmaDoesCode |
| kid | take your kid to work day, game makers | GameMakerKid10 |
| ghost | closed as a duplicate | ClosedAsDuplicate |
| duck | the rubber duck | RubberDuck_Prod |

The name Dave is only a username (and one HAL joke in the AGI text). No spoken line calls
a staff member Dave, because a hired senior gets a random name. The name Chad is spoken
and written everywhere, so the founder should stay Chad.

## Assumptions where the docs were silent

- **`best_rating` is the best Reddit Score out of 40**, not out of 10. Achievements read
  20, 30 and 36. A perfect 40 sets `perfect_scores` or `best_rating >= 40`, either works.
- **Ending `tag` is static text with no numbers**, so the sim can print its own numbers
  next to it. Ranks: S unicorn, A acquired and famous, B ramen, C acquihire, D zombie,
  F runway and podcast. Where a rank has two endings, pick at random, or lean on karma
  (over nine thousand) for `famous` and on a survived founder for `podcast`.
- **`INTRO` plays once on a new game, right before `TUTORIAL.welcome`.**
- **An event `line` plays when the popup opens, a choice `line` plays after the click.**
- **Event cash is year 1 dollars.** Every effect value follows the scales in
  `docs/DESIGN.md` except a few small cash costs, where the price is the joke (pizza,
  a sticky note, a T shirt). Those are deliberately real prices.
- **Hints show numbers only for cash, tokens, days, progress and spaghetti**, and every
  one of them matches the effect it describes. Mood, hype and karma stay vague.
- **Vignettes have 1 to 4 comments.** The first comment is the root, the one the sim
  scores from `judges`. Every vignette has a `when`, and `topic` marks vignettes that
  should not appear together.

## Counters

Sim counters read by achievements: `apps_shipped`, `best_rating`, `friday_deploys`,
`bankrupt_scares`, `hires`, `fires`, `perfect_scores`, `months_survived`.

Event counters, each set by a `counter` effect in `events.ts`: `tests_deleted`,
`accepted_all`, `rewrites`, `hallucinated`, `keys_leaked`, `prod_deleted`, `pivots`,
`all_nighters`, `duck_talks`, `cat_pets`, `coffee_crises`, `merge_conflicts`,
`legal_letters`, `vc_pitches`, `viral`, `naps`, `bounties`. `intern_oops` is also set
by three events but no achievement reads it.

Achievements also read the company directly: cash, karma, spaghetti, `officeTier`,
`hasArchetype` and `hasTrait`.

## `story.ts` playback

`INTRO` is a straight run of `DialogueStep`s. Everything else is keyed or randomised.

`TUTORIAL`, each key plays once per save, the first time its moment happens:

| Key | Trigger |
|---|---|
| `welcome` | first time in the office, right after `INTRO` |
| `idea` | idea picker opens |
| `tool` | tool picker opens |
| `team` | team assignment opens |
| `hotidea` | first hot idea lightbulb appears |
| `event` | first event popup opens |
| `channel` | launch channel picker opens |
| `thread` | first Reddit thread opens |
| `payday` | first payday |
| `hire` | jobs board opens |
| `tokens` | tokens drop low |
| `spaghetti` | spaghetti passes 40 |
| `cash` | cash drops under $10,000 |
| `karma` | karma unlocks something |

- `DEPLOY`: steps 0 to 5 are independent beats, play two at random. The last step is the
  countdown and always plays last.
- `MONTH_NARRATION`: independent narrator lines, pick one at the start of a month, no repeats
  until the pool is spent.
- `FRIDAY.ask` plays when the player must choose. Then `yolo` or `wait` plays by the choice.
- `FUNDING.pass` or `FUNDING.fail` plays at the investor meeting at the end of years 1 and 2.
- `YEAR_END['1' | '2' | '3']` is the Vibey Awards. Year 3 is the last show before the ending card.
- `AMBIENT` is office chatter, pick one now and then while the team works.

## Type changes I wish the contract had

1. `VoiceLine.caption`, on screen text that differs from the spoken text. The duck only
   says Quack, and a caption like "I think the bug is on line 40" is a better joke.
2. `Ending.when`, or a `pick` hint, so the sim does not hard code which of two endings
   a rank gets.
3. Targeted effects: `mood` and `fire` by archetype id (the intern, the designer), and a
   percent of cash effect that scales with the economy for rent and loans.
4. `EventChoice.followUp`, the id of an event to queue next, for trilogies like prod gone,
   the backup from March, the intern's lunch order.
5. `DialogueStep` with a silent caption, so a tutorial hint costs no voice budget.
6. `GameEvent.once`, a cleaner way to say "only ever happens once" than a `lacks()` guard.
