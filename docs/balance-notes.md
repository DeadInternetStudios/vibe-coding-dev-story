# Balance notes

How the money is tuned, what the bots prove, and how to move it without breaking it.

## The test

`npx tsx tools/balance.ts <seeds> <chill|normal|ramen> <strategies>` plays whole three year games with the shipped content
(not the small test fixture) and prints bankruptcies, apps shipped, final score and ranks per strategy. Strategies live in `src/sim/bot.ts`:

| bot | plays like |
|---|---|
| smart | reads what it can afford, picks the best project and plan cards, hires for the gaps, avoids Friday, takes the angel check |
| casual | the smart bot with 35 percent of its choices made without thinking and a coin flip on Friday deploys |
| yolo | weekend hacks and MVPs only, speed cards, hires early, never refactors, always deploys on Friday, takes the VC money |
| random, idle | button masher, does nothing |

The bar for a change: smart beats casual, casual beats yolo, yolo is not the best way to play (it should not reach S), random and idle go bankrupt.
After any change to `src/sim` also run `MONEY_SEEDS=12 npx vitest run src/sim/money.test.ts` (180 whole games, the books must match the cash box to the cent).

## Where it stood before the retune

Yolo scored S on chill and normal: 46 to 49 apps against the careful bot's 33 to 35, because every app earns about the same once the team is
strong (stats saturate near 100 by year two) and a weekend hack costs half the time for half the money, so volume wins.

## What moved (`src/sim/config.ts`, `src/sim/launch.ts`, `src/sim/economy.ts`)

- **Scope pays for its time.** The full scope pays 2.5x for 1.8x the time (was 1.4x), a hack pays 0.42x for 0.5x the time (was 0.5x).
- **Shaky apps earn less, smoothly.** Revenue is cut by `(0.6 + 0.4 x min(1, stability / 70)) x (0.8 + 0.2 x min(1, security / 60))`. It used to be a single 20 percent cut under stability 30. `REVENUE.base` went up 15 percent to keep an average product where it was.
- **Friday incidents bite.** An incident costs $4000 (was $1500) and cuts the app's lifetime revenue by 40 percent (was 15 percent).
- **Threads are shorter and fresher.** After five launches a thread has three comment threads instead of four, and votes are scaled by 4/3 so karma per launch does not change. A vignette read before is a quarter as likely each time it could come up again.
- **Rank cuts moved** to S 46M, A 30M, B 16M, C 5M, D 1M, so S needs a run better than any bot's median.
- **Outside money costs more.** A VC round takes 25 percent of the ending (was 20 percent). The angel stays at 5 percent. The reckless bot takes the VC money twice, so it keeps 50 percent of what it built; the careful one keeps 90 percent. This is what made the gap a player can feel: the fresh judge measured 3 to 9 percent before it.

## The second retune: small builds plateau from year two (`SCOPE_KNEE` in `src/sim/config.ts`)

The first retune fixed the order of the final scores, and the last judge still found the reckless bot the richest player for three years: it ended
with 19.9M in the cash box against the careful bot's 12.6M, shipped 46 apps to 24 at almost the same average Reddit score (32.1 against 33.2), and
a player never sees "founder keeps %", only cash and apps. The cause: stats grow with the team's skill and saturate near the cap, so by year two a big team
turns a weekend hack or an MVP into an app as good as the full thing, in half the time.

From year two (`KNEE_FROM_YEAR`) a stat on a hack grows at 15 percent of its pace once it passes 45, on an MVP once it passes 68 (`SCOPE_KNEE`).
The full scope has no knee. Under the knee nothing changes, and year one is left alone on purpose: a first try with the knee in every year made
the casual bot go bankrupt more often in the first months, when a new founder needs the first launches to land. In the project wizard a white tick on
each forecast bar shows the knee, the banner at the start of year two says "Small builds stall", and `forecast` and the sim use the same function
(`scopedStat`, tested against growing a stat one step at a time in `src/sim/scope.test.ts`).
It adds no money writer: it changes what a project turns into, so the books the money audit checks are unchanged.
The careful bot builds full apps by year two, so its numbers did not move; the reckless bot lost about a third of its final score.

What was tried and left out: a hard cap on stats per scope (casual 8 percent bankrupt on normal), the knee in every year (see above), and a market bar that
scales with the scope (it lifted the careful bot and left the reckless bot's cash where it was).

## Where it stands (median final score, 48 seeds)

| | smart | casual | yolo |
|---|---|---|---|
| normal | 40.1M | 35.2M | 20.4M |
| ramen | 34.5M | 28.4M | 15.9M |
| chill | 49.8M | 43.0M | 24.5M |

Final cash in the box (median, 48 seeds): normal 12.8M, 9.9M and 12.3M; ramen 10.3M, 7.3M and 9.0M; chill 17.0M, 13.4M and 15.9M. The reckless bot no longer ends
richer than the careful one on any difficulty. Average Reddit score of the apps it ships: 27.7 against 33.0 on normal (26.3 against 32.5 on Ramen, 27.5 against 34.2 on chill).

Normal ranks: smart A 42, S 5, B 1. Casual A 37, B 10, S 1. Yolo B 45, C 3, so a reckless run is a B and never reaches A or S.
Bankruptcies: none on normal; on Ramen 0 percent smart, 10 percent casual, 6 percent yolo; on chill 2 percent yolo.
Random and idle bots go bankrupt in 71 to 100 percent of runs.

`src/sim/balance.test.ts` holds this in place on 12 seeds of the shipped content: smart beats yolo by 1.6x, yolo ships at least 1.5x the apps with an average score
at least 3 points lower, and yolo does not end with more than 1.05 times the careful bot's cash.

## Known limits

- The bots are a proxy. They prove that care beats volume in the model, not that it feels good. Watch real players.
- The reckless bot still ships twice the apps (45 to 23 on normal). They are worse and earn less: over three years the apps earn 12.0M against the careful bot's 15.1M (median of 16 seeds, normal), and the monthly revenue in the middle of year two is 379k against 543k. Its cash box ends level with the careful bot's (12.3M to 12.8M on normal) and is often ahead of it before that, because it takes every VC check (the careful bot takes the smaller angel money) and does not refactor, while the careful bot spends on cleanup and tools. Cash is a planning number, not the win condition: the score at the top of the screen (IF YOU QUIT NOW) is behind from about day 365 (4.4M against 6.3M) and the rank at the end is B at best.
- On Ramen the casual bot goes bankrupt more often than the reckless one. Its random third of choices includes bad money moves, which the reckless bot never makes. That is the bot, not the model.
- S is common for the smart bot on chill (about three runs in four). That is the cozy mode, but if it should be rarer, give chill its own rank cuts.
- If reckless play should hurt more still, lower the knees in `SCOPE_KNEE` (not below about 45 for a hack and 65 for an MVP, or a casual first year gets harsh), raise `FRIDAY.incidentCost`, lower `SCOPES.hack.money`, or add a fatigue on shipping many small apps in a row.
