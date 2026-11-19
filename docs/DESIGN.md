# Vibe Coding Dev Story: design bible

One page for every agent and person working on the game. If this file and the
code disagree, the code wins and this file gets fixed.

## Pitch

Game Dev Story (Kairosoft) with the setting swapped: you run a tiny startup
whose staff vibe code apps with AI. You pick an app idea (a kind of app for a
niche audience), pick an AI tool, assign a team, watch them prompt, debug and
ship, then a fake Reddit reads your launch thread out loud, every commenter in a
voice designed with Qwen3-TTS 1.7B VoiceDesign. Karma and money come in, bills go
out, you hire, you grow, you survive three years and get acquired (or go broke).

The audience is Reddit programmers: r/ProgrammerHumor, r/webdev, r/ClaudeAI,
r/cursor, r/ExperiencedDevs, r/singularity, r/cscareerquestions, Hacker News.
They love self deprecating dev culture, AI sycophancy memes, and being seen.

**The wow:** you ship, and the comment section talks.

## Tone guide (read before writing a single joke)

- Affectionate roast. We laugh WITH developers and vibe coders, never down at a
  group. The senior dev is grumpy and right. The intern is chaotic and lovable. The
  AI is relentlessly agreeable. The founder is a visionary with no vision.
- Specific beats generic. "Fourteen thousand console errors" beats "lots of bugs".
  Numbers, file names, error codes, real dev nouns. Short sentences. One punchline,
  at the end of the line.
- Reddit native, not Reddit cringe. Real habits: "Edit: thanks for the gold,
  kind stranger", "This.", "Source: trust me bro", "Nobody: / Me:", u/AutoModerator,
  "Well, actually", "ELI5", "OP delivers", "Username checks out", "I'm not crying you're crying",
  "have you tried turning it off and on again". Use sparingly, twist them, never
  stack three memes in one line.
- Evergreen dev jokes that always land: works on my machine, deploy on Friday,
  left-pad, node_modules, it's DNS, off by one, tabs vs spaces, regex, rm -rf,
  force push, API key in the frontend, Bobby Tables, "I could build this in a weekend",
  rubber duck, Stack Overflow "closed as duplicate", 4,000 line function, TODO: fix later,
  Dependabot, AWS bill, pivot to AI, ramen profitable, Series A, "we're pre-revenue".
- AI and vibe coding jokes: "You're absolutely right!", Accept All, the AI deleted
  the tests so they pass, the AI deleted prod and said "I panicked", `// rest of your code here`,
  hallucinated npm packages, context window full and it forgot everything, rate limit,
  "let me rewrite it from scratch", confident wrong answers, fixing a bug by adding seven.
- Tool and company names are puns, never the real brand: Clod (the AI), Chatty,
  Cursed IDE, Terminal Agent, Agent Swarm, Replet. Reddit, Hacker News, Stack Overflow,
  Product Hunt, LinkedIn and Y Combinator style names are fine to mention directly.
- Never: slurs, politics, religion, sex, drugs beyond coffee and energy drinks,
  self harm, mocking disability, real named people, targeting a real company's staff,
  jokes that need a real tragedy. No swearing beyond "damn", "hell", "crap".
- **Plain ASCII only** in every string. The pixel fonts have no emoji, no curly
  quotes, no em dashes. Use `'` and `"`, `...` for an ellipsis, `-` for a dash.
  A test enforces it.
- Voiced lines are spoken, so write for the ear: contractions, short clauses,
  numbers as words when they are small ("four thousand lines"), no URLs, no code,
  no symbols. 4 to 20 words. One breath. Add a `delivery` note when the acting
  matters ("deadpan", "whispering, terrified", "shouting with joy").

## Core loop

    pick an idea -> pick a tool -> assign a team -> watch it get built (events!)
    -> ship (channel, Friday decision) -> the thread talks -> karma + money -> bills -> grow

Time: 1 tick is 1 day. A month is 4 weeks of 7 days (28 days). A year is 12 months.
The run is 3 years. At 1x a week lasts about 6 seconds. Speeds 1x, 2x, 4x, 8x, pause.

### Resources

| Name | Start | Notes |
|---|---|---|
| cash | $40,000 | bills on payday, the last day of each month. Below zero twice means bankrupt |
| tokens | 300 (k) | AI usage. Each working staff member burns `tool.tokens` per day. Plan refill each month. At 0 the team is rate limited until you top up or the month turns |
| karma | 0 | reddit fame. Lifts launch hype and unlocks things |
| spaghetti | 10 / 100 | how cursed the codebase is. Raises bug chance and disaster chance. Shipping messy code adds, a refactor week removes |

### Staff

Five skills, each 1 to 99: **prompt** (features, speed, tokens well spent), **taste**
(vibes and polish), **debug** (stability), **paranoia** (security), **hustle**
(launch hype). Also level and xp, mood 0 to 100 (low mood slows and bugs up),
salary, one or two traits. Archetypes set the starting ranges. Roles: Vibe Coder,
Prompt Engineer, Senior Dev, Designer, Product Manager, Growth Hacker, Intern,
QA Gremlin, DevOps Goblin, Security Nerd, Community Manager, Data Scientist (claims),
Founder's Friend, Contractor. Special arrivals through events: Rubber Duck,
Stack Overflow Ghost, Office Cat, The Hacker, 10x Engineer (rumored), the AGI (almost).

### Products

A product is a **kind** (what) for a **niche** (who) built with a **tool** at a
**scope** (hack: 4 weeks, mvp: 8 to 12, full: 16 to 20). Name comes from templates.
Four phases: Plan, Prompt, Fix, Ship. Staff contribute stat points each day by phase.
Five stats 0 to 100: **vibes, features, polish, stability, security**. Quality is the
weighted blend using the kind's `weights`. Compatibility of kind and niche
(favors, curses) shifts hype and revenue. Hot ideas are random sparks the player can
tap for a big stat bonus.

### Launch and the thread

Launch needs a **channel** (a cost, a hype boost, how roasty it is). The thread is
an OP post plus 2 or 3 **vignettes** chosen by `when` and `weight` with the tone mixed
so there is always at least one joke at the player's expense, whatever they built.
The root commenter of each vignette gives an N/10 from `judges`. Four root ratings
add up to the Reddit Score out of 40, like Game Dev Story's reviewers. Each comment is
spoken in its voice while the text types out and the karma counter spins.

### Money and growth

Payday each month: salaries, rent, tool subscriptions, tokens plan, cloud bill (grows
with users), snacks. Revenue per app is a launch spike then a long tail, scaled by
quality, hype, kind, karma, and bugs. Funding rounds at the end of year 1 and 2 need a
valuation target and pay out cash. The end of year 3 is the exit: the ending is picked by
valuation and survival. Office tiers add desks (garage 4, shared office 8, loft 12,
tower 16) and cost rent.

## Scales for content values

- Staff salary $2,500 to $11,000 a month. A starting team of 3 burns about $12,000.
- A small app earns $8,000 to $40,000 over its life, a great one 5x that, late game
  apps millions. Event cash is in year 1 dollars and the sim scales it up each year.
- Event numbers: cash ±300 to ±1,500 small, ±2,000 to ±6,000 medium, ±10,000 to ±25,000 big.
  karma ±20 to ±800, spaghetti ±2 to ±15, mood ±5 to ±25, hype ±5 to ±30, tokens ±20 to ±100.
- Skills increase by 1 to 3 from events. Never more than 5.

## Content files (all in `src/content/`)

Every file exports one typed array. Types are in `types.ts`. Voiced lines use `vo()`
from `vo.ts`. `index.ts` re-exports everything and `content.test.ts` enforces counts,
unique ids, lengths, ASCII, known voices, and that every referenced id exists.

| File | Export | Count | Notes |
|---|---|---|---|
| `kinds.ts` | `KINDS` | 14 | todo, landing, ext, bot, wrapper, crm, dash, shop, social, game, mobile, dapp, cli, chat (add api, os late unlocks if you have great ideas) |
| `niches.ts` | `NICHES` | 14 | dogs, cats, plumbers, lawyers, parents, genz, devs, vegans, degens, teachers, gamers, boomers, introverts, redditors |
| `tools.ts` | `TOOLS` | 7 | free chatbot tab, autocomplete pal, Cursed IDE, terminal agent, agent swarm, local LLM on a 2014 ThinkPad, plus one wild late unlock |
| `traits.ts` | `TRAITS` | 24 | each with mods |
| `staff.ts` | `ARCHETYPES`, `FIRST_NAMES`, `LAST_NAMES`, `COMPANY_NAMES` | 14 + 6 special archetypes, 80 first names, 60 last names, 24 startup names | |
| `channels.ts` | `CHANNELS` | 8 | quiet launch, r/SideProject, Show HN, Product Hunt, r/ProgrammerHumor, LinkedIn post, influencer, big ad |
| `events.ts` | `EVENTS` | 90 | dev 40, month 28, launch 12, rare 12. About half have a spoken `line` |
| `threads.ts` | `VIGNETTES`, `OP_BODIES` | 90 vignettes, 20 OP bodies | the wow. Cover every kind, every stat extreme, every channel flavor, Friday deploys, high spaghetti, famous niches |
| `flavor.ts` | `LOADING`, `TIPS`, `HEADLINES`, `PAYDAY_ITEMS`, `COMMIT_MESSAGES`, `APP_REVIEWS`, `AMBIENT` | 60, 40, 60, 30, 40, 40, voiced ambient 40 | `AMBIENT` is `VoiceLine[]` for office chatter |
| `achievements.ts` | `ACHIEVEMENTS` | 40 | |
| `endings.ts` | `ENDINGS` | 8 | S to F ranks plus bankruptcy variants, each with an announcer line |
| `story.ts` | `INTRO`, `TUTORIAL`, `YEAR_END`, `FUNDING`, `FRIDAY`, `DEPLOY`, `MONTH_NARRATION` | see file | scripted `DialogueStep[]` set pieces: the first minute, the Friday deploy decision, the awards show, the investor meeting |

Voiced line budget for the whole game is about 600. Reuse the seed lines in
`tools/tts/cast.seed.md` word for word where they fit, same voice and same delivery,
so no audio is rendered twice.

## Voices

`clod chad dave jenny automod announcer narrator vc karen bro pedant doomer linkedin
arch ghost duck hacker wholesome grandma kid` (see `vo.ts`). Match the voice to the
character: a pedantic comment is `pedant`, the AI apologizing is `clod`, the bot
removing a post is `automod`. Reddit usernames should hint at who is talking
(u/ArchBTW_2012, u/ThrilledAndHumbled, u/WellActuallyGuy).

## Commands

    npm run dev          Vite dev server
    npm run typecheck    tsc
    npm test             vitest, includes content validation
    npm run vo:export    writes tools/tts/lines.json from the content
